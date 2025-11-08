const express = require('express');
const CheckIn = require('../models/CheckIn');
const CameraData = require('../models/CameraData');
const Court = require('../models/Court');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/analytics/court/:courtId
// @desc    Get analytics for a specific court
// @access  Public
router.get('/court/:courtId', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const courtId = req.params.courtId;

    // Check if court exists
    const court = await Court.findById(courtId);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: 'Court not found'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get check-in analytics
    const checkInAnalytics = await CheckIn.aggregate([
      {
        $match: {
          court: courtId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          averageCrowdLevel: { $avg: '$crowdLevel' },
          checkInCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' }
        }
      },
      {
        $project: {
          hour: '$_id',
          averageCrowdLevel: { $round: ['$averageCrowdLevel', 1] },
          checkInCount: 1,
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      },
      {
        $sort: { hour: 1 }
      }
    ]);

    // Get camera data analytics
    const cameraAnalytics = await CameraData.getAverageByHour(courtId, parseInt(days));

    // Get daily patterns
    const dailyPatterns = await CheckIn.aggregate([
      {
        $match: {
          court: courtId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          averageCrowdLevel: { $avg: '$crowdLevel' },
          checkInCount: { $sum: 1 }
        }
      },
      {
        $project: {
          dayOfWeek: '$_id',
          averageCrowdLevel: { $round: ['$averageCrowdLevel', 1] },
          checkInCount: 1
        }
      },
      {
        $sort: { dayOfWeek: 1 }
      }
    ]);

    // Get crowd level distribution
    const crowdDistribution = await CheckIn.aggregate([
      {
        $match: {
          court: courtId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$crowdLevel',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get recent trends (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const recentTrends = await CheckIn.find({
      court: courtId,
      createdAt: { $gte: last24Hours }
    })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(20);

    res.json({
      success: true,
      analytics: {
        court: {
          id: court._id,
          name: court.name,
          sportType: court.sportType
        },
        period: {
          days: parseInt(days),
          startDate,
          endDate: new Date()
        },
        hourlyPatterns: checkInAnalytics,
        cameraData: cameraAnalytics,
        dailyPatterns,
        crowdDistribution,
        recentTrends: recentTrends.map(trend => ({
          id: trend._id,
          user: trend.user,
          crowdLevel: trend.crowdLevel,
          comment: trend.comment,
          createdAt: trend.createdAt
        })),
        summary: {
          totalCheckIns: checkInAnalytics.reduce((sum, item) => sum + item.checkInCount, 0),
          averageCrowdLevel: checkInAnalytics.length > 0 
            ? (checkInAnalytics.reduce((sum, item) => sum + item.averageCrowdLevel, 0) / checkInAnalytics.length).toFixed(1)
            : 0,
          peakHour: checkInAnalytics.length > 0 
            ? checkInAnalytics.reduce((peak, item) => item.checkInCount > peak.checkInCount ? item : peak, checkInAnalytics[0]).hour
            : null,
          busiestDay: dailyPatterns.length > 0 
            ? dailyPatterns.reduce((busiest, item) => item.checkInCount > busiest.checkInCount ? item : busiest, dailyPatterns[0]).dayOfWeek
            : null
        }
      }
    });
  } catch (error) {
    console.error('Get court analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/analytics/user/:userId
// @desc    Get analytics for a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const userId = req.params.userId;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get user's check-in patterns
    const checkInPatterns = await CheckIn.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          checkInCount: { $sum: 1 },
          averageCrowdLevel: { $avg: '$crowdLevel' }
        }
      },
      {
        $project: {
          hour: '$_id',
          checkInCount: 1,
          averageCrowdLevel: { $round: ['$averageCrowdLevel', 1] }
        }
      },
      {
        $sort: { hour: 1 }
      }
    ]);

    // Get favorite sports
    const favoriteSports = await CheckIn.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'courts',
          localField: 'court',
          foreignField: '_id',
          as: 'courtData'
        }
      },
      {
        $unwind: '$courtData'
      },
      {
        $group: {
          _id: '$courtData.sportType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get activity by day of week
    const weeklyActivity = await CheckIn.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          checkInCount: { $sum: 1 }
        }
      },
      {
        $project: {
          dayOfWeek: '$_id',
          checkInCount: 1
        }
      },
      {
        $sort: { dayOfWeek: 1 }
      }
    ]);

    // Get recent activity
    const recentActivity = await CheckIn.find({
      user: userId,
      createdAt: { $gte: startDate }
    })
    .populate('court', 'name sportType location')
    .sort({ createdAt: -1 })
    .limit(10);

    res.json({
      success: true,
      analytics: {
        userId,
        period: {
          days: parseInt(days),
          startDate,
          endDate: new Date()
        },
        hourlyPatterns: checkInPatterns,
        favoriteSports,
        weeklyActivity,
        recentActivity: recentActivity.map(activity => ({
          id: activity._id,
          court: activity.court,
          crowdLevel: activity.crowdLevel,
          comment: activity.comment,
          createdAt: activity.createdAt
        })),
        summary: {
          totalCheckIns: checkInPatterns.reduce((sum, item) => sum + item.checkInCount, 0),
          favoriteSport: favoriteSports.length > 0 ? favoriteSports[0]._id : null,
          mostActiveHour: checkInPatterns.length > 0 
            ? checkInPatterns.reduce((peak, item) => item.checkInCount > peak.checkInCount ? item : peak, checkInPatterns[0]).hour
            : null,
          mostActiveDay: weeklyActivity.length > 0 
            ? weeklyActivity.reduce((peak, item) => item.checkInCount > peak.checkInCount ? item : peak, weeklyActivity[0]).dayOfWeek
            : null
        }
      }
    });
  } catch (error) {
    console.error('Get user analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/analytics/global
// @desc    Get global analytics
// @access  Public
router.get('/global', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get total stats
    const totalCourts = await Court.countDocuments({ isActive: true });
    const totalCheckIns = await CheckIn.countDocuments({ createdAt: { $gte: startDate } });
    const totalUsers = await CheckIn.distinct('user', { createdAt: { $gte: startDate } });

    // Get sport popularity
    const sportPopularity = await CheckIn.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'courts',
          localField: 'court',
          foreignField: '_id',
          as: 'courtData'
        }
      },
      {
        $unwind: '$courtData'
      },
      {
        $group: {
          _id: '$courtData.sportType',
          checkInCount: { $sum: 1 },
          averageCrowdLevel: { $avg: '$crowdLevel' }
        }
      },
      {
        $sort: { checkInCount: -1 }
      }
    ]);

    // Get busiest courts
    const busiestCourts = await CheckIn.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$court',
          checkInCount: { $sum: 1 },
          averageCrowdLevel: { $avg: '$crowdLevel' }
        }
      },
      {
        $lookup: {
          from: 'courts',
          localField: '_id',
          foreignField: '_id',
          as: 'courtData'
        }
      },
      {
        $unwind: '$courtData'
      },
      {
        $project: {
          court: {
            id: '$_id',
            name: '$courtData.name',
            sportType: '$courtData.sportType',
            location: '$courtData.location'
          },
          checkInCount: 1,
          averageCrowdLevel: { $round: ['$averageCrowdLevel', 1] }
        }
      },
      {
        $sort: { checkInCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Get peak hours globally
    const globalPeakHours = await CheckIn.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          checkInCount: { $sum: 1 },
          averageCrowdLevel: { $avg: '$crowdLevel' }
        }
      },
      {
        $project: {
          hour: '$_id',
          checkInCount: 1,
          averageCrowdLevel: { $round: ['$averageCrowdLevel', 1] }
        }
      },
      {
        $sort: { hour: 1 }
      }
    ]);

    res.json({
      success: true,
      analytics: {
        period: {
          days: parseInt(days),
          startDate,
          endDate: new Date()
        },
        overview: {
          totalCourts,
          totalCheckIns,
          totalActiveUsers: totalUsers.length,
          averageCheckInsPerUser: totalUsers.length > 0 ? (totalCheckIns / totalUsers.length).toFixed(1) : 0
        },
        sportPopularity,
        busiestCourts,
        globalPeakHours,
        summary: {
          mostPopularSport: sportPopularity.length > 0 ? sportPopularity[0]._id : null,
          busiestCourt: busiestCourts.length > 0 ? busiestCourts[0].court.name : null,
          peakHour: globalPeakHours.length > 0 
            ? globalPeakHours.reduce((peak, item) => item.checkInCount > peak.checkInCount ? item : peak, globalPeakHours[0]).hour
            : null
        }
      }
    });
  } catch (error) {
    console.error('Get global analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

