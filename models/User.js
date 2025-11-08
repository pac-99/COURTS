const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  reputationScore: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCheckIns: {
    type: Number,
    default: 0
  },
  badges: [{
    type: String,
    enum: ['early_bird', 'night_owl', 'consistent', 'helpful', 'explorer', 'local_legend']
  }],
  favoriteCourts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Court'
  }],
  preferences: {
    sports: [{
      type: String,
      enum: ['basketball', 'tennis', 'pickleball', 'soccer', 'volleyball', 'badminton']
    }],
    notifications: {
      type: Boolean,
      default: true
    },
    radius: {
      type: Number,
      default: 10 // km
    }
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for geospatial queries
userSchema.index({ location: '2dsphere' });

// Virtual for user stats
userSchema.virtual('stats').get(function() {
  return {
    reputationScore: this.reputationScore,
    totalCheckIns: this.totalCheckIns,
    badges: this.badges.length,
    memberSince: this.createdAt
  };
});

// Method to update reputation score
userSchema.methods.updateReputation = function(points) {
  this.reputationScore += points;
  return this.save();
};

// Method to add badge
userSchema.methods.addBadge = function(badgeType) {
  if (!this.badges.includes(badgeType)) {
    this.badges.push(badgeType);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to check if user has badge
userSchema.methods.hasBadge = function(badgeType) {
  return this.badges.includes(badgeType);
};

module.exports = mongoose.model('User', userSchema);

