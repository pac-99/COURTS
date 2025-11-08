const mongoose = require('mongoose');

const cameraDataSchema = new mongoose.Schema({
  court: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Court',
    required: true
  },
  occupancyCount: {
    type: Number,
    required: true,
    min: 0
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  crowdLevel: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  imageUrl: {
    type: String,
    default: null
  },
  processingTime: {
    type: Number, // milliseconds
    default: 0
  },
  metadata: {
    weather: {
      type: String,
      enum: ['sunny', 'cloudy', 'rainy', 'snowy', 'windy', 'unknown'],
      default: 'unknown'
    },
    timeOfDay: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night'],
      default: 'unknown'
    },
    lighting: {
      type: String,
      enum: ['good', 'poor', 'artificial', 'unknown'],
      default: 'unknown'
    }
  },
  isProcessed: {
    type: Boolean,
    default: true
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
cameraDataSchema.index({ court: 1, createdAt: -1 });
cameraDataSchema.index({ createdAt: -1 });
cameraDataSchema.index({ crowdLevel: 1 });

// Virtual for age of data
cameraDataSchema.virtual('ageMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
});

// Virtual for data freshness
cameraDataSchema.virtual('isFresh').get(function() {
  return this.ageMinutes < 30; // Data is fresh if less than 30 minutes old
});

// Static method to get latest data for a court
cameraDataSchema.statics.getLatestForCourt = function(courtId) {
  return this.findOne({ court: courtId })
    .sort({ createdAt: -1 });
};

// Static method to get data for analytics
cameraDataSchema.statics.getAnalyticsData = function(courtId, startDate, endDate) {
  return this.find({
    court: courtId,
    createdAt: {
      $gte: startDate,
      $lte: endDate
    },
    isProcessed: true
  }).sort({ createdAt: 1 });
};

// Static method to get average occupancy by hour
cameraDataSchema.statics.getAverageByHour = function(courtId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        court: mongoose.Types.ObjectId(courtId),
        createdAt: { $gte: startDate },
        isProcessed: true
      }
    },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        averageOccupancy: { $avg: '$occupancyCount' },
        averageCrowdLevel: { $avg: '$crowdLevel' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

module.exports = mongoose.model('CameraData', cameraDataSchema);

