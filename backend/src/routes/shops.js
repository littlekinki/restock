const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Shop = require('../models/Shop');

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
            // Distributors and riders see all shops
            shops = await Shop.find().sort({ createdAt: -1 });
        }
        
        res.json({ success: true, shops });
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

module.exports = router;