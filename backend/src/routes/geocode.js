const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { geocodeAddress } = require('../services/geocodeService');

// ============================================================
// POST /api/geocode/search
// Body: { street, city, state }
// Returns: { success, lat, lng, displayName } or { success: false, error }
// ============================================================
router.post('/search', auth, async (req, res) => {
    try {
        const { street, city, state } = req.body || {};

        if (!street && !city && !state) {
            return res.status(400).json({
                success: false,
                error: 'Provide at least one of: street, city, state',
            });
        }

        const result = await geocodeAddress(street, city, state);
        return res.json(result);

    } catch (error) {
        console.error('Geocode route error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;