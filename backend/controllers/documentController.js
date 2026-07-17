const Document = require('../models/Document');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Activity = require('../models/Activity');
const { sendResponse, getPagination, buildPaginationMeta, buildSortObject } = require('../utils/helpers');
const { ROLES, DOCUMENT_STATUS, ACTIVITY_TYPES, COMMENT_ACTIONS } = require('../utils/constants');
const { notifyManagers, notifyDirectors, notifyEmployee } = require('../services/notificationService');
const fs = require('fs');
const path = require('path');

const uploadDocument = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.ADMIN) {
      return sendResponse(res, 403, false, 'Admin cannot upload documents.');
    }

    if (!req.file) {
      return sendResponse(res, 400, false, 'Please upload a file (PDF, DOC, or DOCX).');
    }

    const { title, description, saveAsDraft } = req.body;

    const status = saveAsDraft === 'true' ? DOCUMENT_STATUS.DRAFT : DOCUMENT_STATUS.SUBMITTED;

    const document = await Document.create({
      title,
      description: description || '',
      file: {
        path: `/uploads/documents/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      },
      uploadedBy: req.user._id,
      department: req.user.department,
      status,
      currentApprover: status === DOCUMENT_STATUS.SUBMITTED ? ROLES.MANAGER : null,
      submittedAt: status === DOCUMENT_STATUS.SUBMITTED ? new Date() : null
    });

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.UPLOAD,
      target: { documentId: document._id, documentTitle: title },
      details: `Document "${title}" uploaded as ${status}`,
      ipAddress: req.ip
    });

    if (status === DOCUMENT_STATUS.SUBMITTED) {
      const managers = await User.find({
        role: ROLES.MANAGER,
        department: req.user.department,
        isActive: true
      });
      await notifyManagers(managers, req.user, title, document._id, req.user.department);
    }

    const populated = await Document.findById(document._id).populate('uploadedBy', 'name email department');

    sendResponse(res, 201, true, `Document ${status === DOCUMENT_STATUS.DRAFT ? 'saved as draft' : 'submitted'} successfully.`, { document: populated });
  } catch (error) {
    next(error);
  }
};

const getMyDocuments = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const sort = buildSortObject(req.query.sort);

    const filter = { uploadedBy: req.user._id };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      const matchedUsers = await User.find({ name: searchRegex }).select('_id');
      const userIds = matchedUsers.map(u => u._id);
      
      filter.$or = [
        { title: searchRegex },
        { uploadedBy: { $in: userIds } }
      ];
    }

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .populate('uploadedBy', 'name email department')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Document.countDocuments(filter)
    ]);

    sendResponse(res, 200, true, 'Documents retrieved.', { documents }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

const getDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('uploadedBy', 'name email department avatar')
      .populate({
        path: 'approvalHistory.user',
        select: 'name email role department avatar'
      });

    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (req.user.role === ROLES.EMPLOYEE && document.uploadedBy._id.toString() !== req.user._id.toString()) {
      return sendResponse(res, 403, false, 'You can only view your own documents.');
    }

    if ((req.user.role === ROLES.MANAGER || req.user.role === ROLES.DIRECTOR) &&
        document.department !== req.user.department) {
      return sendResponse(res, 403, false, 'You can only access documents from your department.');
    }

    const comments = await Comment.find({ document: document._id })
      .populate('user', 'name email role department avatar')
      .sort({ createdAt: -1 });

    sendResponse(res, 200, true, 'Document retrieved.', { document, comments });
  } catch (error) {
    next(error);
  }
};

const updateDraft = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return sendResponse(res, 403, false, 'You can only edit your own documents.');
    }

    if (document.status !== DOCUMENT_STATUS.DRAFT && document.status !== DOCUMENT_STATUS.REVISION_REQUESTED) {
      return sendResponse(res, 400, false, 'Only drafts and revision-requested documents can be edited.');
    }

    if (req.body.title) document.title = req.body.title;
    if (req.body.description !== undefined) document.description = req.body.description;

    if (req.file) {
      document.previousVersions.push({
        file: { ...document.file.toObject() },
        version: document.version,
        replacedAt: new Date()
      });

      const oldFilePath = path.join(__dirname, '..', document.file.path);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      document.file = {
        path: `/uploads/documents/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      };
      document.version += 1;
    }

    let transitioned = false;
    if (document.status === DOCUMENT_STATUS.REVISION_REQUESTED) {
      document.status = DOCUMENT_STATUS.SUBMITTED;
      document.currentApprover = ROLES.MANAGER;
      document.submittedAt = new Date();
      transitioned = true;
    }

    await document.save();

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.UPDATE,
      target: { documentId: document._id, documentTitle: document.title },
      details: `Document "${document.title}" updated (v${document.version})`,
      ipAddress: req.ip
    });

    if (transitioned) {
      const managers = await User.find({
        role: ROLES.MANAGER,
        department: document.department,
        isActive: true
      });
      await notifyManagers(managers, req.user, document.title, document._id, document.department);
    }

    const populated = await Document.findById(document._id).populate('uploadedBy', 'name email department');
    sendResponse(res, 200, true, 'Document updated successfully.', { document: populated });
  } catch (error) {
    next(error);
  }
};

const deleteDraft = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (document.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return sendResponse(res, 403, false, 'You can only delete your own documents.');
    }

    if (document.status !== DOCUMENT_STATUS.DRAFT && req.user.role !== ROLES.ADMIN) {
      return sendResponse(res, 400, false, 'Only draft documents can be deleted.');
    }

    const filePath = path.join(__dirname, '..', document.file.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    for (const prev of document.previousVersions) {
      const prevPath = path.join(__dirname, '..', prev.file.path);
      if (fs.existsSync(prevPath)) {
        fs.unlinkSync(prevPath);
      }
    }

    await Comment.deleteMany({ document: document._id });
    await Document.findByIdAndDelete(document._id);

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.DELETE,
      target: { documentTitle: document.title },
      details: `Document "${document.title}" deleted`,
      ipAddress: req.ip
    });

    sendResponse(res, 200, true, 'Document deleted successfully.');
  } catch (error) {
    next(error);
  }
};

const submitDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return sendResponse(res, 403, false, 'You can only submit your own documents.');
    }

    if (document.status !== DOCUMENT_STATUS.DRAFT && document.status !== DOCUMENT_STATUS.REVISION_REQUESTED) {
      return sendResponse(res, 400, false, 'Only drafts and revision-requested documents can be submitted.');
    }

    document.status = DOCUMENT_STATUS.SUBMITTED;
    document.currentApprover = ROLES.MANAGER;
    document.submittedAt = new Date();
    await document.save();

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.SUBMIT,
      target: { documentId: document._id, documentTitle: document.title },
      details: `Document "${document.title}" submitted for approval`,
      ipAddress: req.ip
    });

    const managers = await User.find({
      role: ROLES.MANAGER,
      department: req.user.department,
      isActive: true
    });
    await notifyManagers(managers, req.user, document.title, document._id, req.user.department);

    sendResponse(res, 200, true, 'Document submitted for approval.');
  } catch (error) {
    next(error);
  }
};

const getPendingDocuments = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const sort = buildSortObject(req.query.sort);
    const filter = {};

    if (req.user.role === ROLES.MANAGER) {
      filter.status = { $in: [DOCUMENT_STATUS.SUBMITTED, DOCUMENT_STATUS.UNDER_REVIEW] };
      filter.currentApprover = ROLES.MANAGER;
      filter.department = req.user.department;
    } else if (req.user.role === ROLES.DIRECTOR) {
      filter.status = DOCUMENT_STATUS.MANAGER_APPROVED;
      filter.currentApprover = ROLES.DIRECTOR;
      filter.department = req.user.department;
    } else if (req.user.role === ROLES.ADMIN) {
      if (req.query.status) {
        filter.status = req.query.status;
      }
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      const matchedUsers = await User.find({ name: searchRegex }).select('_id');
      const userIds = matchedUsers.map(u => u._id);
      
      filter.$or = [
        { title: searchRegex },
        { uploadedBy: { $in: userIds } }
      ];
    }

    if (req.query.department && req.user.role === ROLES.ADMIN) {
      filter.department = req.query.department;
    }

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .populate('uploadedBy', 'name email department avatar')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Document.countDocuments(filter)
    ]);

    sendResponse(res, 200, true, 'Pending documents retrieved.', { documents }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

const getApprovalHistory = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const sort = buildSortObject(req.query.sort || 'updatedAt:desc');
    const filter = {};

    if (req.user.role === ROLES.MANAGER) {
      filter.department = req.user.department;
      filter['approvalHistory.user'] = req.user._id;
    } else if (req.user.role === ROLES.DIRECTOR) {
      filter.department = req.user.department;
      filter.status = { $in: [DOCUMENT_STATUS.COMPLETED, DOCUMENT_STATUS.REJECTED, DOCUMENT_STATUS.MANAGER_APPROVED] };
    } else if (req.user.role !== ROLES.ADMIN) {
      filter.uploadedBy = req.user._id;
    }

    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      const matchedUsers = await User.find({ name: searchRegex }).select('_id');
      const userIds = matchedUsers.map(u => u._id);
      
      filter.$or = [
        { title: searchRegex },
        { uploadedBy: { $in: userIds } }
      ];
    }
    if (req.query.department && req.user.role === ROLES.ADMIN) filter.department = req.query.department;

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .populate('uploadedBy', 'name email department avatar')
        .populate('approvalHistory.user', 'name role department')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Document.countDocuments(filter)
    ]);

    sendResponse(res, 200, true, 'Approval history retrieved.', { documents }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

const approveDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (req.user.role !== ROLES.ADMIN && document.department !== req.user.department) {
      return sendResponse(res, 403, false, 'You can only approve documents from your department.');
    }

    const comment = req.body.comment || '';

    if (req.user.role === ROLES.MANAGER) {
      if (document.status !== DOCUMENT_STATUS.SUBMITTED && document.status !== DOCUMENT_STATUS.UNDER_REVIEW) {
        return sendResponse(res, 400, false, 'Document is not in a state that can be approved by a manager.');
      }

      document.status = DOCUMENT_STATUS.MANAGER_APPROVED;
      document.currentApprover = ROLES.DIRECTOR;
      document.approvalHistory.push({
        user: req.user._id,
        role: req.user.role,
        department: req.user.department,
        action: 'Approved',
        comment,
        timestamp: new Date()
      });
      await document.save();

      await Comment.create({
        document: document._id,
        user: req.user._id,
        role: req.user.role,
        department: req.user.department,
        content: comment || 'Approved by Manager',
        action: COMMENT_ACTIONS.APPROVE
      });

      const directors = await User.find({
        role: ROLES.DIRECTOR,
        department: document.department,
        isActive: true
      });
      await notifyDirectors(directors, req.user, document.title, document._id, document.department);

      await notifyEmployee(
        document.uploadedBy._id, document.uploadedBy.email, document.uploadedBy.name,
        req.user, 'Approved', document.title, document._id, comment
      );

    } else if (req.user.role === ROLES.DIRECTOR || req.user.role === ROLES.ADMIN) {
      if (document.status !== DOCUMENT_STATUS.MANAGER_APPROVED) {
        return sendResponse(res, 400, false, 'Document must be manager-approved before director can approve.');
      }

      document.status = DOCUMENT_STATUS.COMPLETED;
      document.currentApprover = null;
      document.completedAt = new Date();
      document.approvalHistory.push({
        user: req.user._id,
        role: req.user.role,
        department: req.user.department,
        action: 'Approved',
        comment,
        timestamp: new Date()
      });
      await document.save();

      await Comment.create({
        document: document._id,
        user: req.user._id,
        role: req.user.role,
        department: req.user.department,
        content: comment || 'Final approval granted',
        action: COMMENT_ACTIONS.APPROVE
      });

      await notifyEmployee(
        document.uploadedBy._id, document.uploadedBy.email, document.uploadedBy.name,
        req.user, 'Completed', document.title, document._id, comment
      );
    } else {
      return sendResponse(res, 403, false, 'You do not have permission to approve documents.');
    }

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.APPROVE,
      target: { documentId: document._id, documentTitle: document.title },
      details: `Document "${document.title}" approved by ${req.user.role}`,
      ipAddress: req.ip
    });

    sendResponse(res, 200, true, 'Document approved successfully.');
  } catch (error) {
    next(error);
  }
};

const rejectDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (req.user.role !== ROLES.ADMIN && document.department !== req.user.department) {
      return sendResponse(res, 403, false, 'You can only reject documents from your department.');
    }

    const comment = req.body.comment || '';

    if (req.user.role === ROLES.MANAGER) {
      if (document.status !== DOCUMENT_STATUS.SUBMITTED && document.status !== DOCUMENT_STATUS.UNDER_REVIEW) {
        return sendResponse(res, 400, false, 'Document cannot be rejected in its current state.');
      }
    } else if (req.user.role === ROLES.DIRECTOR || req.user.role === ROLES.ADMIN) {
      if (document.status !== DOCUMENT_STATUS.MANAGER_APPROVED) {
        return sendResponse(res, 400, false, 'Document must be manager-approved for director rejection.');
      }
    } else {
      return sendResponse(res, 403, false, 'You do not have permission to reject documents.');
    }

    document.status = DOCUMENT_STATUS.REJECTED;
    document.currentApprover = null;
    document.approvalHistory.push({
      user: req.user._id,
      role: req.user.role,
      department: req.user.department,
      action: 'Rejected',
      comment,
      timestamp: new Date()
    });
    await document.save();

    await Comment.create({
      document: document._id,
      user: req.user._id,
      role: req.user.role,
      department: req.user.department,
      content: comment || 'Document rejected',
      action: COMMENT_ACTIONS.REJECT
    });

    await notifyEmployee(
      document.uploadedBy._id, document.uploadedBy.email, document.uploadedBy.name,
      req.user, 'Rejected', document.title, document._id, comment
    );

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.REJECT,
      target: { documentId: document._id, documentTitle: document.title },
      details: `Document "${document.title}" rejected by ${req.user.role}: ${comment}`,
      ipAddress: req.ip
    });

    sendResponse(res, 200, true, 'Document rejected.');
  } catch (error) {
    next(error);
  }
};

const requestRevision = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (req.user.role !== ROLES.ADMIN && document.department !== req.user.department) {
      return sendResponse(res, 403, false, 'You can only request revision for documents from your department.');
    }

    const comment = req.body.comment || '';

    if (req.user.role === ROLES.MANAGER) {
      if (document.status !== DOCUMENT_STATUS.SUBMITTED && document.status !== DOCUMENT_STATUS.UNDER_REVIEW) {
        return sendResponse(res, 400, false, 'Document cannot be sent for revision in its current state.');
      }
    } else if (req.user.role === ROLES.DIRECTOR || req.user.role === ROLES.ADMIN) {
      if (document.status !== DOCUMENT_STATUS.MANAGER_APPROVED) {
        return sendResponse(res, 400, false, 'Document must be manager-approved for director revision request.');
      }
    } else {
      return sendResponse(res, 403, false, 'You do not have permission to request revision.');
    }

    document.status = DOCUMENT_STATUS.REVISION_REQUESTED;
    document.currentApprover = null;
    document.approvalHistory.push({
      user: req.user._id,
      role: req.user.role,
      department: req.user.department,
      action: 'RevisionRequested',
      comment,
      timestamp: new Date()
    });
    await document.save();

    await Comment.create({
      document: document._id,
      user: req.user._id,
      role: req.user.role,
      department: req.user.department,
      content: comment || 'Revision requested',
      action: COMMENT_ACTIONS.REVISION
    });

    await notifyEmployee(
      document.uploadedBy._id, document.uploadedBy.email, document.uploadedBy.name,
      req.user, 'Revision', document.title, document._id, comment
    );

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.REVISION,
      target: { documentId: document._id, documentTitle: document.title },
      details: `Revision requested for "${document.title}" by ${req.user.role}: ${comment}`,
      ipAddress: req.ip
    });

    sendResponse(res, 200, true, 'Revision requested.');
  } catch (error) {
    next(error);
  }
};

const downloadDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (req.user.role === ROLES.EMPLOYEE && document.uploadedBy.toString() !== req.user._id.toString()) {
      return sendResponse(res, 403, false, 'You can only download your own documents.');
    }

    if ((req.user.role === ROLES.MANAGER || req.user.role === ROLES.DIRECTOR) &&
        document.department !== req.user.department) {
      return sendResponse(res, 403, false, 'You can only download documents from your department.');
    }

    const filePath = path.join(__dirname, '..', document.file.path);
    if (!fs.existsSync(filePath)) {
      return sendResponse(res, 404, false, 'File not found on server.');
    }

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.DOWNLOAD,
      target: { documentId: document._id, documentTitle: document.title },
      details: `Document "${document.title}" downloaded`,
      ipAddress: req.ip
    });

    res.download(filePath, document.file.originalName);
  } catch (error) {
    next(error);
  }
};

const getAllDocuments = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const sort = buildSortObject(req.query.sort);
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      const matchedUsers = await User.find({ name: searchRegex }).select('_id');
      const userIds = matchedUsers.map(u => u._id);
      
      filter.$or = [
        { title: searchRegex },
        { uploadedBy: { $in: userIds } }
      ];
    }

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .populate('uploadedBy', 'name email department avatar')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Document.countDocuments(filter)
    ]);

    sendResponse(res, 200, true, 'All documents retrieved.', { documents }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDocument,
  getMyDocuments,
  getDocument,
  updateDraft,
  deleteDraft,
  submitDocument,
  getPendingDocuments,
  getApprovalHistory,
  approveDocument,
  rejectDocument,
  requestRevision,
  downloadDocument,
  getAllDocuments
};
