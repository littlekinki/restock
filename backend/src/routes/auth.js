const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PasswordReset = require('../models/PasswordReset');
const { sendOTPSMS } = require('../services/smsService');
const Shop = require('../models/Shop');
const Distributor = require('../models/Distributor');
const Rider = require('../models/Rider');
const auth = require('../middleware/auth'); 
const { geocodeAddress } = require('../services/geocodeService');

// ============================================================
// PHONE NORMALIZER
// ============================================================
// Converts any Nigerian format to local 0-prefixed format.
// ============================================================
function normalizePhone(phone) {
    if (!phone) return phone;
    let p = phone.replace(/\D/g, '').trim();
    if (p.startsWith('234') && p.length === 13) {
        p = '0' + p.substring(3);
    }
    return p;
}

// ============================================================
// REGISTER
// ============================================================
router.post('/register', async (req, res) => {
    try {
        const { role, businessName, ownerName, phone, password, address } = req.body;

        const normalizedPhone = normalizePhone(phone);

        // Validate required fields
        if (!role || !phone || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Role, phone and password are required' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let user;

        // Create user based on role
        switch (role) {
            case 'shop': {
                const shopAddress = {
                    street: address?.street || '',
                    city: address?.city || '',
                    state: address?.state || '',
                    landmark: address?.landmark || '',
                    lat: 0,
                    lng: 0,
                };

                // ✅ Auto-geocode (non-blocking — failure is fine)
                if (shopAddress.street || shopAddress.city) {
                    try {
                        const geo = await geocodeAddress(shopAddress.street, shopAddress.city, shopAddress.state);
                        if (geo.success) {
                            shopAddress.lat = geo.lat;
                            shopAddress.lng = geo.lng;
                            console.log(`✅ Geocoded shop signup: ${geo.lat}, ${geo.lng}`);
                        } else {
                            console.log(`⚠️ Geocode skipped for shop: ${geo.error}`);
                        }
                    } catch (geoErr) {
                        console.error('⚠️ Geocode threw:', geoErr.message);
                    }
                }

                user = new Shop({
                    businessName,
                    ownerName,
                    phone: normalizedPhone,
                    password: hashedPassword,
                    address: shopAddress,
                });
                break;
            }
            case 'distributor': {
                const distAddress = {
                    street: address?.street || '',
                    city: address?.city || '',
                    state: address?.state || '',
                    landmark: address?.landmark || '',
                    lat: 0,
                    lng: 0,
                };

                // ✅ Auto-geocode
                if (distAddress.street || distAddress.city) {
                    try {
                        const geo = await geocodeAddress(distAddress.street, distAddress.city, distAddress.state);
                        if (geo.success) {
                            distAddress.lat = geo.lat;
                            distAddress.lng = geo.lng;
                            console.log(`✅ Geocoded distributor signup: ${geo.lat}, ${geo.lng}`);
                        } else {
                            console.log(`⚠️ Geocode skipped for distributor: ${geo.error}`);
                        }
                    } catch (geoErr) {
                        console.error('⚠️ Geocode threw:', geoErr.message);
                    }
                }

                user = new Distributor({
                    businessName,
                    ownerName,
                    phone: normalizedPhone,
                    password: hashedPassword,
                    address: distAddress,
                });
                break;
            }
            case 'rider':
                user = new Rider({
                    fullName: ownerName,
                    phone: normalizedPhone,
                    password: hashedPassword
                });
                break;
            default:
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid role. Must be shop, distributor, or rider' 
                });
        }

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: role, phone: normalizedPhone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                role: role,
                name: user.businessName || user.fullName || user.ownerName,
                phone: normalizedPhone,
            },
            message: `${role} registered successfully`
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle duplicate phone number
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number already registered' 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Registration failed' 
        });
    }
});

// ============================================================
// LOGIN
// ============================================================
router.post('/login', async (req, res) => {
    try {
        const { phone, password, role } = req.body;
        const normalizedPhone = normalizePhone(phone);

        if (!phone || !password || !role) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone, password and role are required' 
            });
        }

        let user;
        let userModel;

        // Find user based on role
        switch (role) {
            case 'shop':
                userModel = Shop;
                break;
            case 'distributor':
                userModel = Distributor;
                break;
            case 'rider':
                userModel = Rider;
                break;
            default:
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid role' 
                });
        }

        user = await userModel.findOne({ phone: normalizedPhone });

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: role, phone: user.phone },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                role: role,
                name: user.businessName || user.fullName || user.ownerName,
                phone: user.phone
            },
            message: `Welcome back!`
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Login failed' 
        });
    }
});

// ============================================================
// GET CURRENT USER
// ============================================================
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'No token provided' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        let user;
        let userModel;

        switch (decoded.role) {
            case 'shop':
                userModel = Shop;
                break;
            case 'distributor':
                userModel = Distributor;
                break;
            case 'rider':
                userModel = Rider;
                break;
            default:
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid role' 
                });
        }

        user = await userModel.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                role: decoded.role,
                name: user.businessName || user.fullName || user.ownerName,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ 
            success: false, 
            error: 'Invalid or expired token' 
        });
    }
});

// ============================================================
// SAVE PUSH TOKEN
// ============================================================
router.patch('/push-token', auth, async (req, res) => {
    try {
        const { userId, role, pushToken } = req.body;

        let userModel;
        switch (role) {
            case 'shop': userModel = Shop; break;
            case 'distributor': userModel = Distributor; break;
            case 'rider': userModel = Rider; break;
            default: return res.status(400).json({ success: false, error: 'Invalid role' });
        }

        await userModel.findByIdAndUpdate(userId, { pushToken });
        res.json({ success: true, message: 'Push token saved' });
    } catch (error) {
        console.error('Push token error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// FORGOT PASSWORD — STEP 1: Request OTP
// POST /api/auth/forgot-password
// Body: { phone, role }
// ============================================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { phone, role } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!phone || !role) {
      return res.status(400).json({
        success: false,
        error: 'Phone and role are required',
      });
    }

    if (!['shop', 'distributor', 'rider'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    // Find the user
    let user = null;
    if (role === 'shop') user = await Shop.findOne({ phone: normalizedPhone });
    else if (role === 'distributor') user = await Distributor.findOne({ phone: normalizedPhone });
    else if (role === 'rider') user = await Rider.findOne({ phone: normalizedPhone });

    // Security note: don't leak whether the account exists.
    // But for usability in a small platform, we tell them.
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account found with that phone number for this role',
      });
    }

    // Rate limit: 60-second cooldown between requests
    const recent = await PasswordReset.findOne({
      phone: normalizedPhone,
      role,
      used: false,
      createdAt: { $gt: new Date(Date.now() - 60000) },
    });

    if (recent) {
      const secondsLeft = Math.ceil(
        (60000 - (Date.now() - recent.createdAt.getTime())) / 1000
      );
      return res.status(429).json({
        success: false,
        error: `Please wait ${secondsLeft} seconds before requesting another code`,
      });
    }

    // Invalidate any old unused OTPs for this phone+role
    await PasswordReset.updateMany(
      { phone: normalizedPhone, role, used: false },
      { $set: { used: true } }
    );

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await PasswordReset.create({
      phone: normalizedPhone,
      role,
      otp,
      expiresAt,
      used: false,
    });

    // Send via SMS
    try {
      await sendOTPSMS(normalizedPhone, otp);
      console.log(`📱 OTP sent to ${normalizedPhone}`);
    } catch (smsError) {
      console.error('⚠️ OTP SMS failed:', smsError.message);
      // In dev/testing, allow fallback: log OTP to console
      console.log(`🔑 [DEV FALLBACK] OTP for ${normalizedPhone}: ${otp}`);
    }

    res.json({
      success: true,
      message: 'Verification code sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// FORGOT PASSWORD — STEP 2: Verify OTP
// POST /api/auth/verify-otp
// Body: { phone, role, otp }
// ============================================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, role, otp } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!phone || !role || !otp) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    const record = await PasswordReset.findOne({
      phone: normalizedPhone,
      role,
      otp,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired code',
      });
    }

    res.json({ success: true, message: 'Code verified' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// FORGOT PASSWORD — STEP 3: Reset password
// POST /api/auth/reset-password
// Body: { phone, role, otp, newPassword }
// ============================================================
router.post('/reset-password', async (req, res) => {
  try {
    const { phone, role, otp, newPassword } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!phone || !role || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    // Verify OTP again (never trust the client)
    const record = await PasswordReset.findOne({
      phone: normalizedPhone,
      role,
      otp,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired code',
      });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 10);

    // Update the right model
    let updated = null;
    if (role === 'shop') {
      updated = await Shop.findOneAndUpdate({ phone: normalizedPhone }, { password: hashed });
    } else if (role === 'distributor') {
      updated = await Distributor.findOneAndUpdate({ phone: normalizedPhone }, { password: hashed });
    } else if (role === 'rider') {
      updated = await Rider.findOneAndUpdate({ phone: normalizedPhone }, { password: hashed });
    }

    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Mark OTP as used
    record.used = true;
    await record.save();

    console.log(`✅ Password reset for ${role} ${normalizedPhone}`);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;