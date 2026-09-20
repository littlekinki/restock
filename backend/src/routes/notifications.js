const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// ============================================================
// GET /api/notifications
// List current user's notifications (paginated)
// ============================================================
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 30, unreadOnly = 'false' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { recipientId: req.user.id };
    if (unreadOnly === 'true') filter.read = false;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: req.user.id, read: false }),
    ]);

    res.json({
      success: true,
      notifications: items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: skip + items.length < total,
      },
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// GET /api/notifications/unread-count
// ============================================================
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.user.id,
      read: false,
    });
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// PATCH /api/notifications/read-all
// Mark all as read
// ============================================================
router.patch('/read-all', auth, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipientId: req.user.id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ success: true, modified: result.modifiedCount });
  } catch (error) {
    console.error('Read-all error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// PATCH /api/notifications/:id/read
// Mark one as read
// ============================================================
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    res.json({ success: true, notification: notif });
  } catch (error) {
    console.error('Mark-read error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// DELETE /api/notifications/:id
// Delete one
// ============================================================
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.id,
      recipientId: req.user.id,
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// DELETE /api/notifications
// Clear all for user
// ============================================================
router.delete('/', auth, async (req, res) => {
  try {
    const result = await Notification.deleteMany({ recipientId: req.user.id });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Clear all error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;