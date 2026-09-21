const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// Routes
const aiOrderRoutes = require('./routes/ai-order');
const orderRoutes = require('./routes/orders');
const shopRoutes = require('./routes/shops');
const distributorRoutes = require('./routes/distributors');
const riderRoutes = require('./routes/riders');
const whatsappRoutes = require('./routes/whatsapp');
const smsRoutes = require('./routes/sms');
const productRequestRoutes = require('./routes/productRequests');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

app.use('/api/orders', aiOrderRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/riders', riderRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/product-requests', productRequestRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/geocode', require('./routes/geocode'));

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Restock API is running 🚀',
    endpoints: {
      orders: '/api/orders',
      shops: '/api/shops',
      distributors: '/api/distributors',
      riders: '/api/riders'
    }
  });
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📋 Test API at http://localhost:${PORT}/`);

      // ✅ Start the notification cleanup job
      startNotificationCleanup();
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('💡 Make sure MongoDB is running on your computer');
  });

// ============================================================
// NOTIFICATION CLEANUP JOB
// ============================================================
// Deletes notifications older than 30 days.
// Runs once on startup + every 24 hours.
// ============================================================
function startNotificationCleanup() {
  const Notification = require('./models/Notification');
  const RETENTION_DAYS = 30;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const runCleanup = async () => {
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * ONE_DAY_MS);
      const result = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} notifications older than ${RETENTION_DAYS} days`);
      } else {
        console.log(`🧹 Notification cleanup: nothing to delete`);
      }
    } catch (error) {
      console.error('⚠️ Notification cleanup error:', error.message);
    }
  };

  // Run once on startup (after a small delay to let server finish booting)
  setTimeout(runCleanup, 10000);

  // Then run every 24 hours
  setInterval(runCleanup, ONE_DAY_MS);

  console.log(`🧹 Notification cleanup job scheduled (retention: ${RETENTION_DAYS} days)`);
}