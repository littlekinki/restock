const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Distributor = require('../models/Distributor');

// GET all distributors
router.get('/', auth, async (req, res) => {
  try {
    const distributors = await Distributor.find().sort({ createdAt: -1 });
    res.json({ success: true, distributors });
  } catch (error) {
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

module.exports = router;