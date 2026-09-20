const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const Order = require('../models/Order');
const Distributor = require('../models/Distributor');
const Shop = require('../models/Shop');

// ============================================================
// GET /api/admin/earnings
// Returns overall platform cash flow + per-order breakdown
// ============================================================
router.get('/earnings', auth, adminOnly, async (req, res) => {
  try {
    const { range = 'all' } = req.query;

    // Date filter
    let dateFilter = {};
    const now = new Date();
    if (range === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: start } };
    } else if (range === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      dateFilter = { createdAt: { $gte: start } };
    } else if (range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: start } };
    }

    const orders = await Order.find(dateFilter)
      .populate('shopId', 'businessName phone')
      .populate('distributorId', 'businessName phone')
      .sort({ createdAt: -1 });

    // ============================================================
    // Aggregates
    // ============================================================
    let totalOrders = orders.length;

    // Outgoing = what you've paid distributors (recorded manually)
    let totalPaidToDistributors = 0;
    let unpaidToDistributors = 0;

    // Incoming = what shops owe/paid you
    let totalIncomingDelivered = 0;
    let pendingIncoming = 0;

    // Counters
    let deliveredCount = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let inTransitCount = 0;

    orders.forEach(o => {
      if (o.status === 'delivered') {
        deliveredCount++;
        totalIncomingDelivered += o.total || 0;
      } else if (o.status === 'pending') {
        pendingCount++;
        pendingIncoming += o.total || 0;
      } else if (o.status === 'confirmed') {
        confirmedCount++;
        pendingIncoming += o.total || 0;
      } else if (o.status === 'picked_up' || o.status === 'out_for_delivery') {
        inTransitCount++;
        pendingIncoming += o.total || 0;
      }

      // Outgoing tracking
      if (o.paidToDistributorAt) {
        totalPaidToDistributors += o.paidToDistributorAmount || 0;
      } else if (o.status !== 'cancelled') {
        // Not yet paid — you still owe this to the distributor
        unpaidToDistributors += o.total || 0;
      }
    });

    const netPosition = totalIncomingDelivered - totalPaidToDistributors;

    // ============================================================
    // Per-order breakdown (latest 100)
    // ============================================================
    const breakdown = orders.slice(0, 100).map(o => ({
      _id: o._id,
      orderId: `#${o._id.toString().slice(-6).toUpperCase()}`,
      status: o.status,
      createdAt: o.createdAt,
      shopName: o.shopId?.businessName || 'Unknown',
      distributorName: o.distributorId?.businessName || 'Unknown',
      total: o.total || 0,
      deliveryFee: o.deliveryFee || 0,
      paidToDistributor: !!o.paidToDistributorAt,
      paidAt: o.paidToDistributorAt,
      paidAmount: o.paidToDistributorAmount || 0,
    }));

    res.json({
      success: true,
      range,
      summary: {
        totalOrders,
        deliveredCount,
        pendingCount,
        confirmedCount,
        inTransitCount,
        totalIncomingDelivered,
        pendingIncoming,
        totalPaidToDistributors,
        unpaidToDistributors,
        netPosition,
      },
      breakdown,
    });
  } catch (error) {
    console.error('Admin earnings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;