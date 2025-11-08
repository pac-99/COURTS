const express = require('express');
const Court = require('../models/Court');
const CheckIn = require('../models/CheckIn');
const CameraData = require('../models/CameraData');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/courts/nearby
// @desc    Get nearby courts
// @access  Public
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10, sportType } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude and longitude are required' 
      });
    }

    const courts = await Court.findNearby(
      parseFloat(lng),
      parseFloat(lat),
      parseFloat(radius),
      sportType
    );

    res.json({
      success: true,
      courts: courts.map(court => ({
        id: court._id,
        name: court.name,
        description: court.description,
        sportType: court.sportType,
        location: court.location,
        amenities: court.amenities,
        currentStatus: court.currentStatus,
        statusColor: court.statusColor,
        statusText: court.statusText,
        rating: court.rating,
        images: court.images.slice(0, 3), // Limit to 3 images
        verified: court.verified
      }))
    });
  } catch (error) {
    console.error('Get nearby courts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/courts/:id
// @desc    Get court details
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const court = await Court.findById(req.params.id)
      .populate('images.uploadedBy', 'name profilePicture');

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    // Get recent check-ins
    const recentCheckIns = await CheckIn.getRecentForCourt(court._id, 5);

    // Get latest camera data
    const latestCameraData = await CameraData.getLatestForCourt(court._id);

    res.json({
      success: true,
      court: {
        id: court._id,
        name: court.name,
        description: court.description,
        sportType: court.sportType,
        location: court.location,
        amenities: court.amenities,
        operatingHours: court.operatingHours,
        cameraFeed: court.cameraFeed,
        currentStatus: court.currentStatus,
        statusColor: court.statusColor,
        statusText: court.statusText,
        rating: court.rating,
        images: court.images,
        verified: court.verified,
        recentCheckIns,
        latestCameraData
      }
    });
  } catch (error) {
    console.error('Get court error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/courts
// @desc    Create new court
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      description,
      coordinates,
      address,
      sportType,
      amenities,
      operatingHours,
      cameraFeed
    } = req.body;

    const court = new Court({
      name,
      description,
      location: {
        type: 'Point',
        coordinates: [coordinates.lng, coordinates.lat]
      },
      address,
      sportType,
      amenities: amenities || [],
      operatingHours: operatingHours || {},
      cameraFeed: cameraFeed || {}
    });

    await court.save();

    res.status(201).json({
      success: true,
      court: {
        id: court._id,
        name: court.name,
        sportType: court.sportType,
        location: court.location,
        currentStatus: court.currentStatus
      }
    });
  } catch (error) {
    console.error('Create court error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/courts/:id
// @desc    Update court
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);

    if (!court) {
      return res.status(404).json({ success: false, message: 'Court not found' });
    }

    const {
      name,
      description,
      coordinates,
      address,
      sportType,
      amenities,
      operatingHours,
      cameraFeed
    } = req.body;

    if (name) court.name = name;
    if (description) court.description = description;
    if (coordinates) {
      court.location.coordinates = [coordinates.lng, coordinates.lat];
    }
    if (address) court.address = address;
    if (sportType) court.sportType = sportType;
    if (amenities) court.amenities = amenities;
    if (operatingHours) court.operatingHours = operatingHours;
    if (cameraFeed) court.cameraFeed = cameraFeed;

    await court.save();

    res.json({
      success: true,
      court: {
        id: court._id,
        name: court.name,
        description: court.description,
        sportType: court.sportType,
        location: court.location,
        amenities: court.amenities,
        operatingHours: court.operatingHours,
        cameraFeed: court.cameraFeed
      }
    });
  } catch (error) {
    console.error('Update court error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/courts/search/:query
// @desc    Search courts by name or address
// @access  Public
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const { lat, lng, radius = 10 } = req.query;

    let searchQuery = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { address: { $regex: query, $options: 'i' } }
      ],
      isActive: true
    };

    // If location provided, add proximity filter
    if (lat && lng) {
      searchQuery.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radius) * 1000
        }
      };
    }

    const courts = await Court.find(searchQuery)
      .limit(20)
      .populate('images.uploadedBy', 'name profilePicture');

    res.json({
      success: true,
      courts: courts.map(court => ({
        id: court._id,
        name: court.name,
        description: court.description,
        sportType: court.sportType,
        location: court.location,
        currentStatus: court.currentStatus,
        statusColor: court.statusColor,
        statusText: court.statusText,
        rating: court.rating
      }))
    });
  } catch (error) {
    console.error('Search courts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

