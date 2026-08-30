const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Shop = require('../models/Shop');
const Distributor = require('../models/Distributor');
const Rider = require('../models/Rider');
const mongoose = require('mongoose');
const smsService = require('../services/smsService');

// ============================================================
// CREATE ORDER - POST /api/orders
// ============================================================
router.post('/', auth, async (req, res) => {
    try {
        console.log('📦 Received order data:', JSON.stringify(req.body, null, 2));

        const {
            shopId,
            distributorId,
            items,
            subtotal,
            total,
            paymentMethod,
            deliveryAddress
        } = req.body;

        const distributor = await Distributor.findById(distributorId);
        if (!distributor) {
            return res.status(404).json({
                success: false,
                error: 'Distributor not found'
            });
        }

        const order = new Order({
            shopId,
            distributorId,
            items,
            subtotal,
            deliveryFee: 0,
            total,
            paymentMethod: paymentMethod || 'cash_on_delivery',
            deliveryAddress: deliveryAddress || {},
            pickupAddress: {
                distributorName: distributor.businessName,
                address: distributor.address?.street || '',
                city: distributor.address?.city || '',
                state: distributor.address?.state || '',
                landmark: distributor.address?.landmark || '',
                lat: distributor.address?.lat || 0,
                lng: distributor.address?.lng || 0,
                phone: distributor.phone
            },
            trackingUpdates: [
                { status: 'pending', note: 'Order placed' }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await order.save();
        console.log('✅ Order created:', order._id);

        // ============================================================
        // ✅ SEND SMS NOTIFICATION 
        // ============================================================
        try {
            await smsService.notifyShopOrderUpdate(order, 'pending');
            console.log(`📱 SMS notification sent for order ${order._id}`);
        } catch (smsError) {
            console.error('⚠️ SMS notification failed:', smsError.message);
        }

        res.status(201).json({
            success: true,
            order,
            message: 'Order created successfully'
        });

    } catch (error) {
        console.error('❌ Create order error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create order'
        });
    }
});

// ============================================================
// GET ALL ORDERS - GET /api/orders 
// ============================================================
router.get('/', auth, async (req, res) => {
    try {
        const { status, shopId, distributorId, riderId, limit = 50 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (shopId) filter.shopId = shopId;
        if (distributorId) filter.distributorId = distributorId;
        if (riderId) filter.riderId = riderId;

        console.log('📋 Fetching orders with filter:', filter);

        const orders = await Order.find(filter)
            .populate('shopId', 'businessName phone address')
            .populate('distributorId', 'businessName phone address')
            .populate('riderId', 'fullName phone vehicleType')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        console.log(`📋 Found ${orders.length} orders`);

        res.json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {
        console.error('❌ Get orders error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch orders'
        });
    }
});

// ============================================================
// GET SINGLE ORDER - GET /api/orders/:id
// ============================================================
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || id === 'null' || id === 'undefined') {
            return res.status(400).json({
                success: false,
                error: 'Invalid order ID provided'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(id)
            .populate('shopId', 'businessName phone address')
            .populate('distributorId', 'businessName phone address')
            .populate('riderId', 'fullName phone vehicleType');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.json({
            success: true,
            order
        });

    } catch (error) {
        console.error('❌ Get single order error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch order'
        });
    }
});

// ============================================================
// UPDATE ORDER STATUS - PATCH /api/orders/:id/status
// ============================================================
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status, note } = req.body;
        const order = await Order.findById(req.params.id)
            .populate('shopId', 'businessName phone')
            .populate('distributorId', 'businessName phone')
            .populate('riderId', 'fullName phone');

        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const validStatuses = ['pending', 'confirmed', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        order.status = status;
        order.trackingUpdates.push({
            status,
            note: note || `Order status updated to ${status}`
        });
        order.updatedAt = Date.now();

        await order.save();

        // ============================================================
        // ✅ SEND SMS NOTIFICATION TO SHOP OWNER
        // ============================================================
        try {
            await smsService.notifyShopOrderUpdate(order, status);
            console.log(`📱 SMS notification sent for order ${order._id}`);
        } catch (smsError) {
            console.error('⚠️ SMS notification failed:', smsError.message);
        }

        if (status === 'delivered' && order.riderId) {
            const rider = await Rider.findById(order.riderId);
            if (rider) {
                rider.earnings += order.deliveryFee || 0;
                rider.totalDeliveries += 1;
                rider.status = 'available';
                await rider.save();
            }
        }

        res.json({ success: true, order, message: `Status updated to ${status}` });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ASSIGN DISTRIBUTOR - PATCH /api/orders/:id/assign-distributor
// ============================================================
router.patch('/:id/assign-distributor', auth,  async (req, res) => {
    try {
        const { distributorId } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const distributor = await Distributor.findById(distributorId);
        if (!distributor) {
            return res.status(404).json({ success: false, error: 'Distributor not found' });
        }

        order.distributorId = distributorId;
        order.status = 'confirmed';
        order.trackingUpdates.push({
            status: 'confirmed',
            note: `Assigned to ${distributor.businessName}`
        });
        await order.save();

        distributor.orders.push(order._id);
        distributor.totalOrders += 1;
        await distributor.save();

        res.json({ success: true, order, message: `Assigned to ${distributor.businessName}` });
    } catch (error) {
        console.error('Assign distributor error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ASSIGN RIDER - PATCH /api/orders/:id/assign-rider
// ============================================================
router.patch('/:id/assign-rider', auth, async (req, res) => {
    console.log('🚨 ASSIGN RIDER ROUTE CALLED!');
    console.log('📦 Order ID:', req.params.id);
    console.log('👤 Rider ID:', req.body.riderId);
    try {
        const { riderId } = req.body;
        const order = await Order.findById(req.params.id)
            .populate('shopId', 'businessName phone');

        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const rider = await Rider.findById(riderId);
        if (!rider) {
            return res.status(404).json({ success: false, error: 'Rider not found' });
        }

        // Generate 4-digit PIN
        const deliveryPIN = String(Math.floor(1000 + Math.random() * 9000));
        console.log(`🔑 Delivery PIN for order ${order._id}: ${deliveryPIN}`);

        order.riderId = riderId;
        order.status = 'picked_up';
        order.deliveryPIN = deliveryPIN;
        order.deliveryProof = 'pending';
        order.trackingUpdates.push({
            status: 'picked_up',
            note: `Assigned to rider ${rider.fullName}. PIN sent to customer.`
        });
        await order.save();

        // ✅ Add delivery to rider's list
        rider.deliveries.push(order._id);
        // ✅ REMOVED: rider.status = 'busy';  ← Allows multiple deliveries
        await rider.save();

        // ============================================================
        // ✅ SEND PIN TO CUSTOMER VIA SMS
        // ============================================================
        try {
            const shop = order.shopId;
            if (shop && shop.phone) {
                const smsMessage = `📦 Restock Delivery PIN\n\nYour order #${order._id.slice(-6).toUpperCase()} is on its way!\n\n🔑 Delivery PIN: ${deliveryPIN}\n\nPlease give this PIN to your rider to confirm delivery.`;
                await smsService.sendSMS(shop.phone, smsMessage);
                console.log(`📱 PIN SMS sent to ${shop.phone}`);
            }
        } catch (smsError) {
            console.error('⚠️ Failed to send PIN SMS:', smsError.message);
        }

        // ============================================================
        // ✅ SEND PIN TO CUSTOMER VIA WHATSAPP
        // ============================================================
        try {
            const shop = order.shopId;
            if (shop && shop.phone) {
                const waMessage = `📦 Restock Delivery PIN\n\nYour order #${order._id.slice(-6).toUpperCase()} is on its way!\n\n🔑 Delivery PIN: ${deliveryPIN}\n\nPlease give this PIN to your rider to confirm delivery.`;
                await sendWhatsAppMessage(shop.phone, waMessage);
                console.log(`📱 PIN WhatsApp sent to ${shop.phone}`);
            }
        } catch (waError) {
            console.error('⚠️ Failed to send PIN WhatsApp:', waError.message);
        }

        res.json({
            success: true,
            order,
            message: `Assigned to rider ${rider.fullName}. PIN sent to customer.`
        });

    } catch (error) {
        console.error('Assign rider error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// VERIFY DELIVERY PIN - POST /api/orders/:id/verify-pin
// ============================================================
router.post('/:id/verify-pin', auth, async (req, res) => {
    try {
        const { pin } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // Check if order has a PIN
        if (!order.deliveryPIN) {
            return res.status(400).json({ 
                success: false, 
                error: 'No delivery PIN set for this order' 
            });
        }

        // Verify the PIN
        if (order.deliveryPIN !== pin) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid delivery PIN. Please try again.' 
            });
        }

        // Mark as delivered
        order.status = 'delivered';
        order.deliveryProof = 'pin_verified';
        order.deliveredAt = new Date();
        order.trackingUpdates.push({
            status: 'delivered',
            note: '✅ Order delivered! PIN verified.'
        });
        await order.save();

        // Update rider earnings
        if (order.riderId) {
            const rider = await Rider.findById(order.riderId);
            if (rider) {
                rider.earnings += order.deliveryFee || 0;
                rider.totalDeliveries += 1;
                rider.status = 'available';
                await rider.save();
            }
        }

        res.json({ 
            success: true, 
            message: '✅ Delivery confirmed! Order marked as delivered.',
            order
        });
    } catch (error) {
        console.error('PIN verification error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// DELETE ORDER - DELETE /api/orders/:id
// ============================================================
router.delete('/:id', auth,  async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        await Shop.updateOne(
            { _id: order.shopId },
            { $pull: { orderHistory: order._id } }
        );

        res.json({ success: true, message: 'Order deleted' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;