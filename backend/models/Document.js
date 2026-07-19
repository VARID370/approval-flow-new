const mongoose = require('mongoose');
const { DOCUMENT_STATUS, DEPARTMENTS } = require('../utils/constants');

const approvalEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  department: { type: String, required: true },
  action: { type: String, required: true },
  comment: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  file: {
    path: { type: String },
    originalName: { type: String },
    mimeType: { type: String },
    size: { type: Number }
  },
  fileUrl: { type: String },
  fileName: { type: String },
  fileType: { type: String },
  fileSize: { type: Number },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: DEPARTMENTS
  },
  status: {
    type: String,
    enum: Object.values(DOCUMENT_STATUS),
    default: DOCUMENT_STATUS.DRAFT
  },
  currentApprover: {
    type: String,
    default: null
  },
  approvalHistory: [approvalEntrySchema],
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    file: {
      path: String,
      originalName: String,
      mimeType: String,
      size: Number
    },
    version: Number,
    replacedAt: { type: Date, default: Date.now }
  }],
  submittedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      if (!ret.file || !ret.file.path) {
        let mimeType = 'application/octet-stream';
        if (ret.fileType === 'pdf') {
          mimeType = 'application/pdf';
        } else if (ret.fileType === 'doc') {
          mimeType = 'application/msword';
        } else if (ret.fileType === 'docx') {
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }
        ret.file = {
          path: ret.fileUrl || '',
          originalName: ret.fileName || 'unknown',
          mimeType: ret.file ? (ret.file.mimeType || mimeType) : mimeType,
          size: ret.file ? (ret.file.size || ret.fileSize || 0) : (ret.fileSize || 0)
        };
      }
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      if (!ret.file || !ret.file.path) {
        let mimeType = 'application/octet-stream';
        if (ret.fileType === 'pdf') {
          mimeType = 'application/pdf';
        } else if (ret.fileType === 'doc') {
          mimeType = 'application/msword';
        } else if (ret.fileType === 'docx') {
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }
        ret.file = {
          path: ret.fileUrl || '',
          originalName: ret.fileName || 'unknown',
          mimeType: ret.file ? (ret.file.mimeType || mimeType) : mimeType,
          size: ret.file ? (ret.file.size || ret.fileSize || 0) : (ret.fileSize || 0)
        };
      }
      return ret;
    }
  }
});

documentSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'document'
});

documentSchema.index({ uploadedBy: 1, status: 1 });
documentSchema.index({ department: 1, status: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
