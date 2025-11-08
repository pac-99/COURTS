const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d'
  });
};

// @route   POST /api/auth/google
// @desc    Authenticate user with Google
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, name, profilePicture } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Update last active
      user.lastActive = new Date();
      await user.save();
    } else {
      // Create new user
      user = new User({
        name,
        email,
        profilePicture,
        reputationScore: 0,
        totalCheckIns: 0
      });
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        reputationScore: user.reputationScore,
        totalCheckIns: user.totalCheckIns,
        badges: user.badges
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/apple
// @desc    Authenticate user with Apple
// @access  Public
router.post('/apple', async (req, res) => {
  try {
    const { appleId, email, name } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Update last active
      user.lastActive = new Date();
      await user.save();
    } else {
      // Create new user
      user = new User({
        name,
        email,
        reputationScore: 0,
        totalCheckIns: 0
      });
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        reputationScore: user.reputationScore,
        totalCheckIns: user.totalCheckIns,
        badges: user.badges
      }
    });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('favoriteCourts', 'name sportType location currentStatus')
      .select('-__v');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        location: user.location,
        reputationScore: user.reputationScore,
        totalCheckIns: user.totalCheckIns,
        badges: user.badges,
        favoriteCourts: user.favoriteCourts,
        preferences: user.preferences,
        lastActive: user.lastActive,
        memberSince: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, location, preferences } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (location) updateData.location = location;
    if (preferences) updateData.preferences = preferences;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        location: user.location,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/favorites/:courtId
// @desc    Add/remove court from favorites
// @access  Private
router.post('/favorites/:courtId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const courtId = req.params.courtId;

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isFavorite = user.favoriteCourts.includes(courtId);

    if (isFavorite) {
      user.favoriteCourts = user.favoriteCourts.filter(id => !id.equals(courtId));
    } else {
      user.favoriteCourts.push(courtId);
    }

    await user.save();

    res.json({
      success: true,
      isFavorite: !isFavorite,
      favoriteCount: user.favoriteCourts.length
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

