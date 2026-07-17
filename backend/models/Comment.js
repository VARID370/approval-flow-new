const mongoose = require('mongoose');
const { COMMENT_ACTIONS } = require('../utils/constants');

const commentSchema = new mongoose.Schema({
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: [true, 'Document reference is required'],
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  role: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },
  action: {
    type: String,
    enum: Object.values(COMMENT_ACTIONS),
    default: COMMENT_ACTIONS.COMMENT
  }
}, {
  timestamps: true
});

commentSchema.index({ document: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
