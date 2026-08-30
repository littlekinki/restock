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
const orderRoutes = require('./routes/orders');
const shopRoutes = require('./routes/shops');
const distributorRoutes = require('./routes/distributors');
const riderRoutes = require('./routes/riders');
const whatsappRoutes = require('./routes/whatsapp');
const smsRoutes = require('./routes/sms');

app.use('/api/orders', orderRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/riders', riderRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/api/sms', smsRoutes);

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
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('💡 Make sure MongoDB is running on your computer');
  });