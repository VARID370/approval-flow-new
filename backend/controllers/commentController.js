const Comment = require('../models/Comment');
const Document = require('../models/Document');
const { sendResponse, getPagination, buildPaginationMeta } = require('../utils/helpers');
const { ROLES } = require('../utils/constants');

const addComment = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    if (req.user.role === ROLES.EMPLOYEE && document.uploadedBy.toString() !== req.user._id.toString()) {
      return sendResponse(res, 403, false, 'You can only comment on your own documents.');
    }

    if ((req.user.role === ROLES.MANAGER || req.user.role === ROLES.DIRECTOR) &&
        document.department !== req.user.department) {
      return sendResponse(res, 403, false, 'You can only comment on documents from your department.');
    }

    const comment = await Comment.create({
      document: document._id,
      user: req.user._id,
      role: req.user.role,
      department: req.user.department,
      content: req.body.content,
      action: req.body.action || 'Comment'
    });

    const populated = await Comment.findById(comment._id)
      .populate('user', 'name email role department avatar');

    sendResponse(res, 201, true, 'Comment added.', { comment: populated });
  } catch (error) {
    next(error);
  }
};

const getDocumentComments = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return sendResponse(res, 404, false, 'Document not found.');
    }

    const filter = { document: req.params.documentId };

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .populate('user', 'name email role department avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments(filter)
    ]);

    sendResponse(res, 200, true, 'Comments retrieved.', { comments }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

module.exports = { addComment, getDocumentComments };
