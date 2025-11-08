const express = require('express');
const CameraData = require('../models/CameraData');
const Court = require('../models/Court');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/camera/data
// @desc    Receive AI camera data (stub for now)
// @access  Private (would be called by AI service)
router.post('/data', async (req, res) => {
  try {
    const {
      courtId,
      occupancyCount,
      confidence,
      crowdLevel,
      imageUrl,
      processingTime,
      metadata
    } = req.body;

    // Validate required fields
    if (!courtId || occupancyCount === undefined || !crowdLevel) {
      return res.status(400).json({
        success: false,
        message: 'Court ID, occupancy count, and crowd level are required'
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

    // Create camera data record
    const cameraData = new CameraData({
      court: courtId,
      occupancyCount: parseInt(occupancyCount),
      confidence: confidence || 0.5,
      crowdLevel: parseInt(crowdLevel),
      imageUrl: imageUrl || null,
      processingTime: processingTime || 0,
      metadata: metadata || {}
    });

    await cameraData.save();

    // Update court's current status if confidence is high enough
    if (confidence >= 0.7) {
      await court.updateCrowdLevel(parseInt(crowdLevel), 'ai');
    }

    res.status(201).json({
      success: true,
      cameraData: {
        id: cameraData._id,
        court: cameraData.court,
        occupancyCount: cameraData.occupancyCount,
        confidence: cameraData.confidence,
        crowdLevel: cameraData.crowdLevel,
        imageUrl: cameraData.imageUrl,
        processingTime: cameraData.processingTime,
        metadata: cameraData.metadata,
        isFresh: cameraData.isFresh,
        createdAt: cameraData.createdAt
      }
    });
  } catch (error) {
    console.error('Camera data error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/camera/data/:courtId
// @desc    Get latest camera data for a court
// @access  Public
router.get('/data/:courtId', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const cameraData = await CameraData.find({ court: req.params.courtId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      cameraData: cameraData.map(data => ({
        id: data._id,
        occupancyCount: data.occupancyCount,
        confidence: data.confidence,
        crowdLevel: data.crowdLevel,
        imageUrl: data.imageUrl,
        processingTime: data.processingTime,
        metadata: data.metadata,
        isFresh: data.isFresh,
        ageMinutes: data.ageMinutes,
        createdAt: data.createdAt
      }))
    });
  } catch (error) {
    console.error('Get camera data error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/camera/latest/:courtId
// @desc    Get latest camera data for a court
// @access  Public
router.get('/latest/:courtId', async (req, res) => {
  try {
    const latestData = await CameraData.getLatestForCourt(req.params.courtId);

    if (!latestData) {
      return res.json({
        success: true,
        cameraData: null,
        message: 'No camera data available'
      });
    }

    res.json({
      success: true,
      cameraData: {
        id: latestData._id,
        occupancyCount: latestData.occupancyCount,
        confidence: latestData.confidence,
        crowdLevel: latestData.crowdLevel,
        imageUrl: latestData.imageUrl,
        processingTime: latestData.processingTime,
        metadata: latestData.metadata,
        isFresh: latestData.isFresh,
        ageMinutes: latestData.ageMinutes,
        createdAt: latestData.createdAt
      }
    });
  } catch (error) {
    console.error('Get latest camera data error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/camera/simulate
// @desc    Simulate camera data for testing (stub)
// @access  Private
router.post('/simulate', auth, async (req, res) => {
  try {
    const { courtId } = req.body;

    if (!courtId) {
      return res.status(400).json({
        success: false,
        message: 'Court ID is required'
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

    // Generate simulated data
    const occupancyCount = Math.floor(Math.random() * 20);
    const confidence = 0.7 + Math.random() * 0.3; // 0.7-1.0
    const crowdLevel = Math.min(5, Math.max(1, Math.ceil(occupancyCount / 4)));
    
    const metadata = {
      weather: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
      timeOfDay: ['morning', 'afternoon', 'evening', 'night'][Math.floor(Math.random() * 4)],
      lighting: ['good', 'poor', 'artificial'][Math.floor(Math.random() * 3)]
    };

    // Create camera data record
    const cameraData = new CameraData({
      court: courtId,
      occupancyCount,
      confidence,
      crowdLevel,
      processingTime: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
      metadata
    });

    await cameraData.save();

    // Update court's current status
    await court.updateCrowdLevel(crowdLevel, 'ai');

    res.status(201).json({
      success: true,
      message: 'Simulated camera data created',
      cameraData: {
        id: cameraData._id,
        court: cameraData.court,
        occupancyCount: cameraData.occupancyCount,
        confidence: cameraData.confidence,
        crowdLevel: cameraData.crowdLevel,
        processingTime: cameraData.processingTime,
        metadata: cameraData.metadata,
        createdAt: cameraData.createdAt
      }
    });
  } catch (error) {
    console.error('Simulate camera data error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/camera/status
// @desc    Get camera system status
// @access  Public
router.get('/status', async (req, res) => {
  try {
    const totalCourts = await Court.countDocuments({ 'cameraFeed.isActive': true });
    const activeCameras = await CameraData.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }, // Last 30 minutes
      isProcessed: true
    });

    const recentData = await CameraData.find({
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }).sort({ createdAt: -1 }).limit(10);

    res.json({
      success: true,
      status: {
        totalCourtsWithCameras: totalCourts,
        activeCameras,
        lastUpdate: recentData.length > 0 ? recentData[0].createdAt : null,
        systemHealth: activeCameras > 0 ? 'operational' : 'limited',
        recentUpdates: recentData.map(data => ({
          court: data.court,
          crowdLevel: data.crowdLevel,
          confidence: data.confidence,
          timestamp: data.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get camera status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

