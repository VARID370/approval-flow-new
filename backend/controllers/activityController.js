const Activity = require('../models/Activity');
const { sendResponse, getPagination, buildPaginationMeta } = require('../utils/helpers');

const getActivityLogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.action) filter.action = req.query.action;
    if (req.query.userId) filter.user = req.query.userId;
    if (req.query.search) {
      filter.details = { $regex: req.query.search, $options: 'i' };
    }

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }

    const [activities, total] = await Promise.all([
      Activity.find(filter)
        .populate('user', 'name email role department')
        .populate('target.documentId', 'title')
        .populate('target.targetUser', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Activity.countDocuments(filter)
    ]);

    sendResponse(res, 200, true, 'Activity logs retrieved.', { activities }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

const getMyActivity = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { user: req.user._id };

    if (req.query.action) filter.action = req.query.action;

    const [activities, total] = await Promise.all([
      Activity.find(filter)
        .populate('target.documentId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Activity.countDocuments(filter)
    ]);

    sendResponse(res, 200, true, 'My activity retrieved.', { activities }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

module.exports = { getActivityLogs, getMyActivity };
