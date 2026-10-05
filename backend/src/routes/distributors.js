const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Distributor = require('../models/Distributor');
const Order = require('../models/Order');

// GET all distributors
router.get('/', auth, async (req, res) => {
    try {
        const distributors = await Distributor.find().lean();

        // Recent orders per distributor
        const distIds = distributors.map(d => d._id);
        const recentOrders = await Order.find({ distributorId: { $in: distIds } })
            .sort({ createdAt: -1 })
            .populate('shopId', 'businessName')
            .lean();

        const byDist = {};
        recentOrders.forEach(o => {
            const key = String(o.distributorId);
            if (!byDist[key]) byDist[key] = [];
            if (byDist[key].length < 5) byDist[key].push(o);
        });

        // Totals per distributor
        const totalsByDist = {};
        const allOrders = await Order.find({ distributorId: { $in: distIds } }).lean();
        allOrders.forEach(o => {
            const key = String(o.distributorId);
            if (!totalsByDist[key]) totalsByDist[key] = { count: 0, revenue: 0, delivered: 0, unpaid: 0 };
            totalsByDist[key].count += 1;
            totalsByDist[key].revenue += o.total || 0;
            if (o.status === 'delivered') totalsByDist[key].delivered += 1;
            if (!o.paidToDistributorAt && o.status !== 'cancelled') {
                totalsByDist[key].unpaid += o.total || 0;
            }
        });

        const enriched = distributors.map(d => ({
            ...d,
            recentOrders: (byDist[String(d._id)] || []).map(o => ({
                _id: o._id,
                orderId: `#${o._id.toString().slice(-6).toUpperCase()}`,
                status: o.status,
                total: o.total || 0,
                shopName: o.shopId?.businessName || 'Unknown',
                createdAt: o.createdAt,
            })),
            totalOrders: totalsByDist[String(d._id)]?.count || 0,
            totalRevenue: totalsByDist[String(d._id)]?.revenue || 0,
            deliveredCount: totalsByDist[String(d._id)]?.delivered || 0,
            unpaidAmount: totalsByDist[String(d._id)]?.unpaid || 0,
        }));

        res.json({ success: true, distributors: enriched });
    } catch (error) {
        console.error('Get distributors error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET single distributor
router.get('/:id', auth, async (req, res) => {
  try {
    const distributor = await Distributor.findById(req.params.id)
      .populate('orders');
    if (!distributor) {
      return res.status(404).json({ success: false, error: 'Distributor not found' });
    }
    res.json({ success: true, distributor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE distributor
router.post('/', auth, async (req, res) => {
  try {
    const distributor = new Distributor(req.body);
    await distributor.save();
    res.status(201).json({ success: true, distributor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE distributor
router.put('/:id', auth, async (req, res) => {
  try {
    const distributor = await Distributor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!distributor) {
      return res.status(404).json({ success: false, error: 'Distributor not found' });
    }
    res.json({ success: true, distributor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE distributor
router.delete('/:id', auth, async (req, res) => {
  try {
    const distributor = await Distributor.findByIdAndDelete(req.params.id);
    if (!distributor) {
      return res.status(404).json({ success: false, error: 'Distributor not found' });
    }
    res.json({ success: true, message: 'Distributor deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// UPDATE NOTIFICATION PREFERENCES - PATCH /api/distributors/:id/notification-prefs
// ============================================================
router.patch('/:id/notification-prefs', auth, async (req, res) => {
    try {
        const { sms, push } = req.body;
        const distributor = await Distributor.findById(req.params.id);
        if (!distributor) return res.status(404).json({ success: false, error: 'Distributor not found' });

        distributor.notificationPrefs = {
            sms: typeof sms === 'boolean' ? sms : (distributor.notificationPrefs?.sms ?? true),
            push: typeof push === 'boolean' ? push : (distributor.notificationPrefs?.push ?? true),
        };
        await distributor.save();

        res.json({ success: true, notificationPrefs: distributor.notificationPrefs });
    } catch (error) {
        console.error('Update notification prefs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// GET DISTRIBUTOR EARNINGS - GET /api/distributors/:id/earnings
// ============================================================
const { cartonEquivalent } = require('../utils/deliveryFee');

router.get('/:id/earnings', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // Auth: only the distributor themselves (or admin) can see their earnings
        const isOwnAccount = req.user.id === id;
        const isAdminPhone =
            process.env.ADMIN_PHONE && req.user.phone === process.env.ADMIN_PHONE;

        if (!isOwnAccount && !isAdminPhone) {
            return res.status(403).json({
                success: false,
                error: 'You can only view your own earnings',
            });
        }

        const orders = await Order.find({ distributorId: id })
            .populate('shopId', 'businessName phone')
            .sort({ createdAt: -1 });

        // ============================================================
        // Aggregates
        // ============================================================
        let totalRevenue = 0;
        let deliveredRevenue = 0;
        let pendingRevenue = 0;
        let cancelledRevenue = 0;

        let totalOrders = orders.length;
        let deliveredCount = 0;
        let pendingCount = 0;
        let confirmedCount = 0;
        let inTransitCount = 0;
        let cancelledCount = 0;

        let totalCartons = 0;
        let deliveredCartons = 0;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let monthRevenue = 0;

        orders.forEach(o => {
            const total = o.total || 0;
            totalRevenue += total;

            if (o.status === 'delivered') {
                deliveredCount++;
                deliveredRevenue += total;
            } else if (o.status === 'pending') {
                pendingCount++;
                pendingRevenue += total;
            } else if (o.status === 'confirmed') {
                confirmedCount++;
                pendingRevenue += total;
            } else if (o.status === 'picked_up' || o.status === 'out_for_delivery') {
                inTransitCount++;
                pendingRevenue += total;
            } else if (o.status === 'cancelled') {
                cancelledCount++;
                cancelledRevenue += total;
            }

            // Carton count (using same weights as delivery fee)
            const cartons = cartonEquivalent(o.items || []);
            totalCartons += cartons;
            if (o.status === 'delivered') deliveredCartons += cartons;

            // This month
            if (new Date(o.createdAt) >= monthStart) {
                monthRevenue += total;
            }
        });

        // ============================================================
        // Per-order breakdown
        // ============================================================
        const breakdown = orders.slice(0, 100).map(o => ({
            _id: o._id,
            orderId: `#${o._id.toString().slice(-6).toUpperCase()}`,
            status: o.status,
            createdAt: o.createdAt,
            shopName: o.shopId?.businessName || 'Unknown',
            total: o.total || 0,
            cartons: cartonEquivalent(o.items || []),
            paidToDistributor: !!o.paidToDistributorAt,
            paidAt: o.paidToDistributorAt,
            paidAmount: o.paidToDistributorAmount || 0,
        }));

        res.json({
            success: true,
            summary: {
                totalOrders,
                deliveredCount,
                pendingCount,
                confirmedCount,
                inTransitCount,
                cancelledCount,
                totalRevenue,
                deliveredRevenue,
                pendingRevenue,
                cancelledRevenue,
                monthRevenue,
                totalCartons,
                deliveredCartons,
                avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
            },
            breakdown,
        });
    } catch (error) {
        console.error('Distributor earnings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;