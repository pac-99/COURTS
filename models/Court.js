const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: {
      type: String,
      required: true
    }
  },
  sportType: {
    type: String,
    required: true,
    enum: ['basketball', 'tennis', 'pickleball', 'soccer', 'volleyball', 'badminton', 'multi']
  },
  amenities: [{
    type: String,
    enum: ['lighting', 'parking', 'restrooms', 'water_fountain', 'seating', 'shade', 'equipment_rental']
  }],
  operatingHours: {
    open: {
      type: String,
      default: '06:00'
    },
    close: {
      type: String,
      default: '22:00'
    },
    days: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
  cameraFeed: {
    url: {
      type: String,
      default: null
    },
    type: {
      type: String,
      enum: ['rtsp', 'http', 'webcam'],
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },
  currentStatus: {
    crowdLevel: {
      type: Number,
      min: 1,
      max: 5,
      default: 1
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: ['user', 'ai', 'hybrid'],
      default: 'user'
    }
  },
  images: [{
    url: String,
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for geospatial queries
courtSchema.index({ location: '2dsphere' });
courtSchema.index({ sportType: 1 });
courtSchema.index({ 'currentStatus.crowdLevel': 1 });

// Virtual for status color
courtSchema.virtual('statusColor').get(function() {
  const level = this.currentStatus.crowdLevel;
  if (level <= 2) return 'green';
  if (level <= 3) return 'yellow';
  return 'red';
});

// Virtual for status text
courtSchema.virtual('statusText').get(function() {
  const level = this.currentStatus.crowdLevel;
  const statuses = {
    1: 'Empty',
    2: 'Light',
    3: 'Moderate',
    4: 'Busy',
    5: 'Very Busy'
  };
  return statuses[level] || 'Unknown';
});

// Method to update crowd level
courtSchema.methods.updateCrowdLevel = function(level, source = 'user') {
  this.currentStatus.crowdLevel = level;
  this.currentStatus.lastUpdated = new Date();
  this.currentStatus.source = source;
  return this.save();
};

// Static method to find nearby courts
courtSchema.statics.findNearby = function(longitude, latitude, maxDistance = 10, sportType = null) {
  const query = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    },
    isActive: true
  };

  if (sportType) {
    query.sportType = sportType;
  }

  return this.find(query).populate('images.uploadedBy', 'name profilePicture');
};

module.exports = mongoose.model('Court', courtSchema);

