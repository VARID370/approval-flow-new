const Document = require('../models/Document');
const User = require('../models/User');
const { sendResponse } = require('../utils/helpers');
const { ROLES, DOCUMENT_STATUS, DEPARTMENTS } = require('../utils/constants');

const getDashboardStats = async (req, res, next) => {
  try {
    const stats = {};

    if (req.user.role === ROLES.EMPLOYEE) {
      const myDocs = await Document.find({ uploadedBy: req.user._id });
      stats.totalDocuments = myDocs.length;
      stats.drafts = myDocs.filter(d => d.status === DOCUMENT_STATUS.DRAFT).length;
      stats.submitted = myDocs.filter(d => d.status === DOCUMENT_STATUS.SUBMITTED).length;
      stats.underReview = myDocs.filter(d => [DOCUMENT_STATUS.UNDER_REVIEW, DOCUMENT_STATUS.MANAGER_APPROVED].includes(d.status)).length;
      stats.completed = myDocs.filter(d => d.status === DOCUMENT_STATUS.COMPLETED).length;
      stats.rejected = myDocs.filter(d => d.status === DOCUMENT_STATUS.REJECTED).length;
      stats.revisionRequested = myDocs.filter(d => d.status === DOCUMENT_STATUS.REVISION_REQUESTED).length;

      const recentDocs = await Document.find({ uploadedBy: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('title status updatedAt');
      stats.recentDocuments = recentDocs;

    } else if (req.user.role === ROLES.MANAGER) {
      stats.pendingApprovals = await Document.countDocuments({
        department: req.user.department,
        status: { $in: [DOCUMENT_STATUS.SUBMITTED, DOCUMENT_STATUS.UNDER_REVIEW] },
        currentApprover: ROLES.MANAGER
      });
      stats.approved = await Document.countDocuments({
        department: req.user.department,
        'approvalHistory.user': req.user._id,
        'approvalHistory.action': 'Approved'
      });
      stats.rejected = await Document.countDocuments({
        department: req.user.department,
        status: DOCUMENT_STATUS.REJECTED,
        'approvalHistory.user': req.user._id
      });
      stats.totalDepartmentDocs = await Document.countDocuments({
        department: req.user.department,
        status: { $ne: DOCUMENT_STATUS.DRAFT }
      });

      const recentPending = await Document.find({
        department: req.user.department,
        status: { $in: [DOCUMENT_STATUS.SUBMITTED, DOCUMENT_STATUS.UNDER_REVIEW] },
        currentApprover: ROLES.MANAGER
      })
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title uploadedBy createdAt');
      stats.recentPending = recentPending;

    } else if (req.user.role === ROLES.DIRECTOR) {
      stats.pendingApprovals = await Document.countDocuments({
        department: req.user.department,
        status: DOCUMENT_STATUS.MANAGER_APPROVED,
        currentApprover: ROLES.DIRECTOR
      });
      stats.completed = await Document.countDocuments({
        department: req.user.department,
        status: DOCUMENT_STATUS.COMPLETED
      });
      stats.rejected = await Document.countDocuments({
        department: req.user.department,
        status: DOCUMENT_STATUS.REJECTED,
        'approvalHistory.user': req.user._id
      });
      stats.totalDepartmentDocs = await Document.countDocuments({
        department: req.user.department,
        status: { $ne: DOCUMENT_STATUS.DRAFT }
      });

      const recentPending = await Document.find({
        department: req.user.department,
        status: DOCUMENT_STATUS.MANAGER_APPROVED,
        currentApprover: ROLES.DIRECTOR
      })
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title uploadedBy createdAt');
      stats.recentPending = recentPending;

    } else if (req.user.role === ROLES.ADMIN) {
      stats.totalUsers = await User.countDocuments();
      stats.activeUsers = await User.countDocuments({ isActive: true });
      stats.totalDocuments = await Document.countDocuments();
      stats.pendingDocuments = await Document.countDocuments({
        status: { $in: [DOCUMENT_STATUS.SUBMITTED, DOCUMENT_STATUS.UNDER_REVIEW, DOCUMENT_STATUS.MANAGER_APPROVED] }
      });
      stats.completedDocuments = await Document.countDocuments({ status: DOCUMENT_STATUS.COMPLETED });
      stats.rejectedDocuments = await Document.countDocuments({ status: DOCUMENT_STATUS.REJECTED });

      stats.usersByRole = await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]);
    }

    sendResponse(res, 200, true, 'Dashboard stats retrieved.', { stats });
  } catch (error) {
    next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = {};

    analytics.totalUsers = await User.countDocuments();
    analytics.totalDocuments = await Document.countDocuments({ status: { $ne: DOCUMENT_STATUS.DRAFT } });
    analytics.pendingDocuments = await Document.countDocuments({
      status: { $in: [DOCUMENT_STATUS.SUBMITTED, DOCUMENT_STATUS.UNDER_REVIEW, DOCUMENT_STATUS.MANAGER_APPROVED] }
    });
    analytics.completedDocuments = await Document.countDocuments({ status: DOCUMENT_STATUS.COMPLETED });
    analytics.rejectedDocuments = await Document.countDocuments({ status: DOCUMENT_STATUS.REJECTED });

    analytics.documentsByDepartment = await Document.aggregate([
      { $match: { status: { $ne: DOCUMENT_STATUS.DRAFT } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    analytics.documentsByStatus = await Document.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const completedDocs = await Document.find({
      status: DOCUMENT_STATUS.COMPLETED,
      submittedAt: { $ne: null },
      completedAt: { $ne: null }
    }).select('submittedAt completedAt');

    if (completedDocs.length > 0) {
      const totalTime = completedDocs.reduce((sum, doc) => {
        return sum + (doc.completedAt - doc.submittedAt);
      }, 0);
      analytics.avgApprovalTimeMs = Math.round(totalTime / completedDocs.length);
      analytics.avgApprovalTimeHours = Math.round(analytics.avgApprovalTimeMs / (1000 * 60 * 60) * 10) / 10;
    } else {
      analytics.avgApprovalTimeMs = 0;
      analytics.avgApprovalTimeHours = 0;
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    analytics.monthlyTrend = await Document.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $ne: DOCUMENT_STATUS.DRAFT } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', DOCUMENT_STATUS.COMPLETED] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', DOCUMENT_STATUS.REJECTED] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    sendResponse(res, 200, true, 'Analytics retrieved.', { analytics });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardStats, getAnalytics };
