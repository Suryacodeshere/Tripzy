import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbService } from '../dbService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tripzy_super_secret_jwt_key_12345';

// Authentication Middleware
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, phone, password, role, vehicleName, vehicleNumber, vehicleType } = req.body;

  if (!name || !email || !phone || !password || !role) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  if (!['rider', 'driver', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  if (role === 'driver' && (!vehicleName || !vehicleNumber)) {
    return res.status(400).json({ message: 'Vehicle name and number are required for drivers.' });
  }

  try {
    // Check if user already exists
    const existingUser = await dbService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await dbService.createUser({
      name,
      email,
      phone,
      passwordHash,
      role
    });

    let driverProfile = null;
    if (role === 'driver') {
      driverProfile = await dbService.createDriverProfile({
        userId: newUser._id,
        vehicleName,
        vehicleNumber,
        vehicleType: vehicleType || 'sedan'
      });
    }

    // Sign JWT
    const token = jwt.sign(
      { userId: newUser._id, role: newUser.role, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      },
      driverProfile: driverProfile ? {
        vehicleName: driverProfile.vehicleName,
        vehicleNumber: driverProfile.vehicleNumber,
        vehicleType: driverProfile.vehicleType,
        rating: driverProfile.rating
      } : null
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    const user = await dbService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = await dbService.getDriverProfileByUserId(user._id);
    }

    // Sign JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      driverProfile: driverProfile ? {
        vehicleName: driverProfile.vehicleName,
        vehicleNumber: driverProfile.vehicleNumber,
        vehicleType: driverProfile.vehicleType,
        rating: driverProfile.rating,
        isOnline: driverProfile.isOnline,
        currentLoc: driverProfile.currentLoc
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbService.findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = await dbService.getDriverProfileByUserId(user._id);
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      driverProfile: driverProfile ? {
        vehicleName: driverProfile.vehicleName,
        vehicleNumber: driverProfile.vehicleNumber,
        vehicleType: driverProfile.vehicleType,
        rating: driverProfile.rating,
        isOnline: driverProfile.isOnline,
        currentLoc: driverProfile.currentLoc
      } : null
    });
  } catch (error) {
    console.error('Fetch user details error:', error);
    res.status(500).json({ message: 'Server error fetching user details.' });
  }
});

// GET /api/auth/users (Fetch All Users - Admin only)
router.get('/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  try {
    const users = await dbService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Fetch all users error:', error);
    res.status(500).json({ message: 'Server error fetching users.' });
  }
});

export default router;
