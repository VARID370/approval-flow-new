const Notification = require('../models/Notification');
const { sendResponse, getPagination, buildPaginationMeta } = require('../utils/helpers');

const getMyNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { recipient: req.user._id };

    if (req.query.unreadOnly === 'true') filter.isRead = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('sender', 'name avatar')
        .populate('document', 'title status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter)
    ]);

    sendResponse(res, 200, true, 'Notifications retrieved.', { notifications }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return sendResponse(res, 404, false, 'Notification not found.');
    }

    sendResponse(res, 200, true, 'Notification marked as read.');
  } catch (error) {
    next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );

    sendResponse(res, 200, true, 'All notifications marked as read.');
  } catch (error) {
    next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });

    sendResponse(res, 200, true, 'Unread count retrieved.', { count });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead, getUnreadCount };
