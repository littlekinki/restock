const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');
const Distributor = require('../models/Distributor');
const Rider = require('../models/Rider');

// ============================================================
// REGISTER
// ============================================================
router.post('/register', async (req, res) => {
    try {
        const { role, businessName, ownerName, phone, password, address } = req.body;

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
            case 'shop':
                user = new Shop({
                    businessName,
                    ownerName,
                    phone,
                    password: hashedPassword,
                    address: address || {}
                });
                break;
            case 'distributor':
                user = new Distributor({
                    businessName,
                    ownerName,
                    phone,
                    password: hashedPassword,
                    address: address || {}
                });
                break;
            case 'rider':
                user = new Rider({
                    fullName: ownerName,
                    phone,
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
            { id: user._id, role: role, phone: user.phone },
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
                phone: user.phone
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

        user = await userModel.findOne({ phone });

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

module.exports = router;