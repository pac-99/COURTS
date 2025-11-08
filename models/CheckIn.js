const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  court: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Court',
    required: true
  },
  crowdLevel: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500
  },
  media: [{
    type: {
      type: String,
      enum: ['image', 'video']
    },
    url: String,
    thumbnail: String,
    duration: Number // for videos
  }],
  weather: {
    temperature: Number,
    condition: {
      type: String,
      enum: ['sunny', 'cloudy', 'rainy', 'snowy', 'windy']
    }
  },
  duration: {
    type: Number, // minutes spent at court
    min: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  helpful: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notHelpful: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Indexes
checkInSchema.index({ user: 1, createdAt: -1 });
checkInSchema.index({ court: 1, createdAt: -1 });
checkInSchema.index({ crowdLevel: 1 });
checkInSchema.index({ createdAt: -1 });

// Virtual for helpfulness score
checkInSchema.virtual('helpfulnessScore').get(function() {
  const helpful = this.helpful.length;
  const notHelpful = this.notHelpful.length;
  const total = helpful + notHelpful;
  
  if (total === 0) return 0;
  return (helpful / total) * 100;
});

// Method to mark as helpful
checkInSchema.methods.markHelpful = function(userId) {
  if (!this.helpful.includes(userId)) {
    this.helpful.push(userId);
    // Remove from not helpful if present
    this.notHelpful = this.notHelpful.filter(id => !id.equals(userId));
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to mark as not helpful
checkInSchema.methods.markNotHelpful = function(userId) {
  if (!this.notHelpful.includes(userId)) {
    this.notHelpful.push(userId);
    // Remove from helpful if present
    this.helpful = this.helpful.filter(id => !id.equals(userId));
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get recent check-ins for a court
checkInSchema.statics.getRecentForCourt = function(courtId, limit = 10) {
  return this.find({ court: courtId })
    .populate('user', 'name profilePicture reputationScore')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get user's check-in history
checkInSchema.statics.getUserHistory = function(userId, limit = 20) {
  return this.find({ user: userId })
    .populate('court', 'name sportType location')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('CheckIn', checkInSchema);

