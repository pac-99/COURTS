const express = require('express');
const multer = require('multer');
const path = require('path');
const CheckIn = require('../models/CheckIn');
const Court = require('../models/Court');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// @route   POST /api/checkins
// @desc    Create new check-in
// @access  Private
router.post('/', auth, upload.array('media', 5), async (req, res) => {
  try {
    const {
      courtId,
      crowdLevel,
      comment,
      weather,
      duration
    } = req.body;

    // Validate required fields
    if (!courtId || !crowdLevel) {
      return res.status(400).json({
        success: false,
        message: 'Court ID and crowd level are required'
      });
    }

    // Check if court exists
    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    // Process uploaded media
    const media = [];
    if (req.files) {
      req.files.forEach(file => {
        media.push({
          type: file.mimetype.startsWith('image/') ? 'image' : 'video',
          url: `/uploads/${file.filename}`,
          thumbnail: file.mimetype.startsWith('image/') ? `/uploads/${file.filename}` : null
        });
      });
    }

    // Create check-in
    const checkIn = new CheckIn({
      user: req.userId,
      court: courtId,
      crowdLevel: parseInt(crowdLevel),
      comment: comment || '',
      media: media,
      weather: weather ? JSON.parse(weather) : null,
      duration: duration ? parseInt(duration) : null
    });

    await checkIn.save();

    // Update court's current status
    await court.updateCrowdLevel(parseInt(crowdLevel), 'user');

    // Update user stats
    const user = await User.findById(req.userId);
    user.totalCheckIns += 1;
    user.lastActive = new Date();

    // Award badges based on check-in patterns
    if (user.totalCheckIns === 1) {
      await user.addBadge('explorer');
    } else if (user.totalCheckIns >= 10) {
      await user.addBadge('consistent');
    }

    await user.save();

    // Populate the response
    await checkIn.populate([
      { path: 'user', select: 'name profilePicture reputationScore' },
      { path: 'court', select: 'name sportType location' }
    ]);

    res.status(201).json({
      success: true,
      checkIn: {
        id: checkIn._id,
        user: checkIn.user,
        court: checkIn.court,
        crowdLevel: checkIn.crowdLevel,
        comment: checkIn.comment,
        media: checkIn.media,
        weather: checkIn.weather,
        duration: checkIn.duration,
        helpfulnessScore: checkIn.helpfulnessScore,
        createdAt: checkIn.createdAt
      }
    });
  } catch (error) {
    console.error('Create check-in error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/checkins/court/:courtId
// @desc    Get check-ins for a specific court
// @access  Public
router.get('/court/:courtId', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const checkIns = await CheckIn.find({ court: req.params.courtId })
      .populate('user', 'name profilePicture reputationScore')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await CheckIn.countDocuments({ court: req.params.courtId });

    res.json({
      success: true,
      checkIns: checkIns.map(checkIn => ({
        id: checkIn._id,
        user: checkIn.user,
        crowdLevel: checkIn.crowdLevel,
        comment: checkIn.comment,
        media: checkIn.media,
        weather: checkIn.weather,
        duration: checkIn.duration,
        helpfulnessScore: checkIn.helpfulnessScore,
        helpful: checkIn.helpful.length,
        notHelpful: checkIn.notHelpful.length,
        createdAt: checkIn.createdAt
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total
      }
    });
  } catch (error) {
    console.error('Get court check-ins error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/checkins/user/:userId
// @desc    Get check-ins for a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const checkIns = await CheckIn.find({ user: req.params.userId })
      .populate('court', 'name sportType location currentStatus')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await CheckIn.countDocuments({ user: req.params.userId });

    res.json({
      success: true,
      checkIns: checkIns.map(checkIn => ({
        id: checkIn._id,
        court: checkIn.court,
        crowdLevel: checkIn.crowdLevel,
        comment: checkIn.comment,
        media: checkIn.media,
        weather: checkIn.weather,
        duration: checkIn.duration,
        helpfulnessScore: checkIn.helpfulnessScore,
        createdAt: checkIn.createdAt
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total
      }
    });
  } catch (error) {
    console.error('Get user check-ins error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/checkins/my
// @desc    Get current user's check-ins
// @access  Private
router.get('/my', auth, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const checkIns = await CheckIn.find({ user: req.userId })
      .populate('court', 'name sportType location currentStatus')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await CheckIn.countDocuments({ user: req.userId });

    res.json({
      success: true,
      checkIns: checkIns.map(checkIn => ({
        id: checkIn._id,
        court: checkIn.court,
        crowdLevel: checkIn.crowdLevel,
        comment: checkIn.comment,
        media: checkIn.media,
        weather: checkIn.weather,
        duration: checkIn.duration,
        helpfulnessScore: checkIn.helpfulnessScore,
        createdAt: checkIn.createdAt
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: total
      }
    });
  } catch (error) {
    console.error('Get my check-ins error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/checkins/:id/helpful
// @desc    Mark check-in as helpful
// @access  Private
router.post('/:id/helpful', auth, async (req, res) => {
  try {
    const checkIn = await CheckIn.findById(req.params.id);

    if (!checkIn) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found'
      });
    }

    await checkIn.markHelpful(req.userId);

    res.json({
      success: true,
      helpfulnessScore: checkIn.helpfulnessScore,
      helpful: checkIn.helpful.length,
      notHelpful: checkIn.notHelpful.length
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/checkins/:id/not-helpful
// @desc    Mark check-in as not helpful
// @access  Private
router.post('/:id/not-helpful', auth, async (req, res) => {
  try {
    const checkIn = await CheckIn.findById(req.params.id);

    if (!checkIn) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found'
      });
    }

    await checkIn.markNotHelpful(req.userId);

    res.json({
      success: true,
      helpfulnessScore: checkIn.helpfulnessScore,
      helpful: checkIn.helpful.length,
      notHelpful: checkIn.notHelpful.length
    });
  } catch (error) {
    console.error('Mark not helpful error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/checkins/:id
// @desc    Delete check-in
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const checkIn = await CheckIn.findById(req.params.id);

    if (!checkIn) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found'
      });
    }

    // Only allow user to delete their own check-ins
    if (!checkIn.user.equals(req.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this check-in'
      });
    }

    await CheckIn.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Check-in deleted successfully'
    });
  } catch (error) {
    console.error('Delete check-in error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

