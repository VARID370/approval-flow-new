const mongoose = require('mongoose');
const { ACTIVITY_TYPES } = require('../utils/constants');

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  action: {
    type: String,
    enum: Object.values(ACTIVITY_TYPES),
    required: [true, 'Action type is required']
  },
  target: {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
    documentTitle: { type: String, default: '' },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  details: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
