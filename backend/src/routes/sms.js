const express = require('express');
const router = express.Router();
const smsService = require('../services/smsService');

// ============================================================
// TEST SMS - POST /api/sms/test
// ============================================================
router.post('/test', async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Please provide phone and message'
            });
        }

        const result = await smsService.sendSMS(phone, message);
        res.json({
            success: true,
            result: result,
            message: 'SMS sent successfully'
        });
    } catch (error) {
        console.error('Test SMS error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;