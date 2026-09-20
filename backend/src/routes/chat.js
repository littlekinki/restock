const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');

// ============================================================
// GET CHAT FOR AN ORDER
// ============================================================
router.get('/order/:orderId', auth, async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, error: 'Invalid order ID' });
        }

        const messages = await Message.find({ orderId })
            .sort({ createdAt: 1 });

        // Mark messages as read
        await Message.updateMany(
            { orderId, receiverId: req.user.id, isRead: false },
            { isRead: true }
        );

        res.json({
            success: true,
            count: messages.length,
            messages
        });
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// SEND MESSAGE
// ============================================================
router.post('/send', auth, async (req, res) => {
    try {
        const { orderId, receiverId, receiverRole, message } = req.body;

        if (!orderId || !receiverId || !receiverRole || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // Get sender name from user data
        const senderName = req.user.name || 'User';
        const senderRole = req.user.role;

        const newMessage = new Message({
            orderId,
            senderId: req.user.id,
            senderRole,
            senderName,
            receiverId,
            receiverRole,
            message
        });

        await newMessage.save();

        // ✅ IN-APP NOTIFICATION to receiver
        try {
            await notificationService.notifyChatMessage(
                { _id: receiverId, role: receiverRole },
                order,
                senderName,
                (message || '').toString().slice(0, 80)
            );
        } catch (notifError) {
            console.error('⚠️ Chat notification failed:', notifError.message);
        }

        res.status(201).json({
            success: true,
            message: newMessage
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================================
// GET UNREAD COUNT
// ============================================================
router.get('/unread/:orderId', auth, async (req, res) => {
    try {
        const count = await Message.countDocuments({
            orderId: req.params.orderId,
            receiverId: req.user.id,
            isRead: false
        });

        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;