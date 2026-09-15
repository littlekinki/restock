const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ProductRequest = require('../models/ProductRequest');
const Shop = require('../models/Shop');
const pushService = require('../services/pushService');

// ============================================================
// CREATE PRODUCT REQUEST (from Shop)
// ============================================================
router.post('/', auth, async (req, res) => {
    try {
        const { productName, category, quantity, unit, notes } = req.body;
        const shopId = req.user.id;

        if (!productName) {
            return res.status(400).json({ success: false, error: 'Product name is required' });
        }

        const request = new ProductRequest({
            shopId,
            productName,
            category: category || 'Other',
            quantity: quantity || 1,
            unit: unit || 'carton',
            notes: notes || ''
        });

        await request.save();

        console.log(`📝 Product request created: ${productName} by shop ${shopId}`);

        res.status(201).json({
            success: true,
            request,
            message: 'Product request submitted! We will find a distributor for you.'
        });

    } catch (error) {
        console.error('Create product request error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// GET ALL PRODUCT REQUESTS (Admin)
// ============================================================
router.get('/', auth, async (req, res) => {
    try {
        const { status, limit = 100 } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const requests = await ProductRequest.find(filter)
            .populate('shopId', 'businessName phone address')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            count: requests.length,
            requests
        });

    } catch (error) {
        console.error('Get product requests error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// GET SHOP'S OWN REQUESTS
// ============================================================
router.get('/my-requests', auth, async (req, res) => {
    try {
        const requests = await ProductRequest.find({ shopId: req.user.id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: requests.length,
            requests
        });

    } catch (error) {
        console.error('Get my requests error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// UPDATE REQUEST STATUS (Admin)
// ============================================================
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status, adminNotes } = req.body;

        const validStatuses = ['pending', 'sourcing', 'found', 'unavailable', 'fulfilled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const request = await ProductRequest.findByIdAndUpdate(
            req.params.id,
            { status, adminNotes: adminNotes || '' },
            { new: true }
        ).populate('shopId', 'businessName phone pushToken');

        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        // Notify shop via push if status is 'found' or 'fulfilled'
        if ((status === 'found' || status === 'fulfilled') && request.shopId?.pushToken) {
            try {
                await pushService.sendPushNotification(
                    request.shopId.pushToken,
                    '🎉 Product Found!',
                    `${request.productName} is now available!`,
                    { productName: request.productName }
                );
            } catch (pushError) {
                console.error('Push failed:', pushError.message);
            }
        }

        res.json({
            success: true,
            request,
            message: `Request status updated to ${status}`
        });

    } catch (error) {
        console.error('Update request error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// DELETE REQUEST (Admin)
// ============================================================
router.delete('/:id', auth, async (req, res) => {
    try {
        const request = await ProductRequest.findByIdAndDelete(req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        res.json({ success: true, message: 'Request deleted' });
    } catch (error) {
        console.error('Delete request error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;