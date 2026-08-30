const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Rider = require('../models/Rider');

// GET all riders
router.get('/', auth, async (req, res) => {
  try {
    const riders = await Rider.find().sort({ createdAt: -1 });
    res.json({ success: true, riders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET nearby riders based on location
router.get('/nearby', auth, async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide lat and lng' 
      });
    }

    // Find all available riders
    const riders = await Rider.find({ 
      status: 'available',
      isActive: true 
    });

    // Calculate distance for each rider (simple filtering)
    // Note: For production, use MongoDB's $geoNear or a proper geospatial query
    const nearbyRiders = riders.filter(rider => {
      // Skip riders without location
      if (!rider.currentLocation || !rider.currentLocation.lat) return false;
      
      const distance = calculateDistance(
        parseFloat(lat), 
        parseFloat(lng),
        rider.currentLocation.lat, 
        rider.currentLocation.lng
      );
      
      return distance <= parseFloat(radius);
    });

    // Sort by distance (closest first)
    nearbyRiders.sort((a, b) => {
      const distA = calculateDistance(
        parseFloat(lat), parseFloat(lng),
        a.currentLocation.lat, a.currentLocation.lng
      );
      const distB = calculateDistance(
        parseFloat(lat), parseFloat(lng),
        b.currentLocation.lat, b.currentLocation.lng
      );
      return distA - distB;
    });

    res.json({ 
      success: true, 
      riders: nearbyRiders,
      count: nearbyRiders.length
    });
  } catch (error) {
    console.error('Error finding nearby riders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single rider
router.get('/:id', auth, async (req, res) => {
  try {
    const rider = await Rider.findById(req.params.id).populate('deliveries');
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }
    res.json({ success: true, rider });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE rider
router.post('/', auth, async (req, res) => {
  try {
    const rider = new Rider(req.body);
    await rider.save();
    res.status(201).json({ success: true, rider });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE rider status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const rider = await Rider.findById(req.params.id);
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }
    rider.status = status;
    await rider.save();
    res.json({ success: true, rider });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE rider location
router.patch('/:id/location', auth, async (req, res) => {
  try {
    const { lat, lng, city, state } = req.body;
    const rider = await Rider.findById(req.params.id);
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }
    rider.currentLocation = { 
      lat, 
      lng, 
      lastUpdated: new Date(),
      city: city || rider.currentLocation?.city || '',
      state: state || rider.currentLocation?.state || ''
    };
    await rider.save();
    res.json({ success: true, rider });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE rider
router.delete('/:id', auth, async (req, res) => {
  try {
    const rider = await Rider.findByIdAndDelete(req.params.id);
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }
    res.json({ success: true, message: 'Rider deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// HELPER: Calculate distance between two coordinates (Haversine)
// ============================================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

module.exports = router;