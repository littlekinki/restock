const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Shop = require('../models/Shop');
const Order = require('../models/Order');

// ============================================================
// GET ALL SHOPS 
// ============================================================
router.get('/', auth, async (req, res) => {
    try {
        let shops;

        // If user is a shop owner, only return their shop
        if (req.user.role === 'shop') {
            const shop = await Shop.findById(req.user.id);
            shops = shop ? [shop] : [];
        } else {
            // Distributors, riders, admins see all shops
            shops = await Shop.find().sort({ createdAt: -1 }).lean();
        }

        // Admin-only enrichment (skip for shop owners to save DB load)
        if (req.user.role === 'shop') {
            return res.json({ success: true, shops });
        }

        // Fetch all orders for these shops
        const shopIds = shops.map(s => s._id);
        const allOrders = await Order.find({ shopId: { $in: shopIds } })
            .sort({ createdAt: -1 })
            .populate('distributorId', 'businessName')
            .lean();

        // Group by shop
        const byShop = {};
        const totalsByShop = {};

        allOrders.forEach(o => {
            const key = String(o.shopId);

            if (!byShop[key]) byShop[key] = [];
            if (byShop[key].length < 5) {
                byShop[key].push({
                    _id: o._id,
                    orderId: `#${o._id.toString().slice(-6).toUpperCase()}`,
                    status: o.status,
                    total: o.total || 0,
                    distributorName: o.distributorId?.businessName || 'Unknown',
                    createdAt: o.createdAt,
                });
            }

            if (!totalsByShop[key]) totalsByShop[key] = { count: 0, spent: 0 };
            totalsByShop[key].count += 1;
            totalsByShop[key].spent += o.total || 0;
        });

        const enriched = shops.map(s => ({
            ...s,
            recentOrders: byShop[String(s._id)] || [],
            totalOrders: totalsByShop[String(s._id)]?.count || 0,
            totalSpent: totalsByShop[String(s._id)]?.spent || 0,
        }));

        res.json({ success: true, shops: enriched });
    } catch (error) {
        console.error('Get shops error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET single shop
router.get('/:id', auth, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id)
      .populate('orderHistory')
      .populate('preferredDistributors');
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    res.json({ success: true, shop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE shop
router.post('/', auth, async (req, res) => {
  try {
    const shop = new Shop(req.body);
    await shop.save();
    res.status(201).json({ success: true, shop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE shop
router.put('/:id', auth, async (req, res) => {
  try {
    const shop = await Shop.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    res.json({ success: true, shop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE shop
router.delete('/:id', auth, async (req, res) => {
  try {
    const shop = await Shop.findByIdAndDelete(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    res.json({ success: true, message: 'Shop deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// UPDATE NOTIFICATION PREFERENCES - PATCH /api/shops/:id/notification-prefs
// ============================================================
router.patch('/:id/notification-prefs', auth, async (req, res) => {
    try {
        const { sms, push } = req.body;
        const shop = await Shop.findById(req.params.id);
        if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

        shop.notificationPrefs = {
            sms: typeof sms === 'boolean' ? sms : (shop.notificationPrefs?.sms ?? true),
            push: typeof push === 'boolean' ? push : (shop.notificationPrefs?.push ?? true),
        };
        await shop.save();

        res.json({ success: true, notificationPrefs: shop.notificationPrefs });
    } catch (error) {
        console.error('Update notification prefs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;