const Notification = require('../models/Notification');
const { sendEmail, emailTemplates } = require('./emailService');

let io = null;
const userSockets = new Map();

const setIO = (socketIO) => {
  io = socketIO;
};

const registerSocket = (userId, socketId) => {
  userSockets.set(userId.toString(), socketId);
};

const removeSocket = (userId) => {
  userSockets.delete(userId.toString());
};

const getSocketId = (userId) => {
  return userSockets.get(userId.toString());
};

const createNotification = async ({ recipient, sender, type, message, document: docId }) => {
  try {
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      message,
      document: docId
    });

    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name avatar')
      .populate('document', 'title');

    const socketId = getSocketId(recipient);
    if (io && socketId) {
      io.to(socketId).emit('notification', populated);
    }

    return notification;
  } catch (error) {
    console.error('Create notification error:', error.message);
    return null;
  }
};

const notifyManagers = async (managers, sender, docTitle, docId, department) => {
  for (const manager of managers) {
    await createNotification({
      recipient: manager._id,
      sender: sender._id,
      type: 'Submitted',
      message: `New document "${docTitle}" submitted by ${sender.name} from ${department} department`,
      document: docId
    });

    if (manager.email) {
      const template = emailTemplates.pendingApproval(manager.name, docTitle, sender.name, department);
      sendEmail(manager.email, template.subject, template.html).catch(() => {});
    }
  }
};

const notifyDirectors = async (directors, sender, docTitle, docId, department) => {
  for (const director of directors) {
    await createNotification({
      recipient: director._id,
      sender: sender._id,
      type: 'Approved',
      message: `Document "${docTitle}" approved by manager and requires your final approval`,
      document: docId
    });

    if (director.email) {
      const template = emailTemplates.pendingApproval(director.name, docTitle, sender.name, department);
      sendEmail(director.email, template.subject, template.html).catch(() => {});
    }
  }
};

const notifyEmployee = async (employeeId, employeeEmail, employeeName, sender, type, docTitle, docId, comment) => {
  let message = '';
  let emailTemplate = null;

  switch (type) {
    case 'Approved':
      message = `Your document "${docTitle}" has been approved by ${sender.name} (${sender.role})`;
      emailTemplate = emailTemplates.documentApproved(employeeName, docTitle, sender.name, sender.role);
      break;
    case 'Rejected':
      message = `Your document "${docTitle}" has been rejected by ${sender.name} (${sender.role})`;
      emailTemplate = emailTemplates.documentRejected(employeeName, docTitle, sender.name, comment);
      break;
    case 'Revision':
      message = `Revision requested on "${docTitle}" by ${sender.name} (${sender.role})`;
      emailTemplate = emailTemplates.revisionRequested(employeeName, docTitle, sender.name, comment);
      break;
    case 'Completed':
      message = `Your document "${docTitle}" has been fully approved and completed`;
      emailTemplate = emailTemplates.documentCompleted(employeeName, docTitle);
      break;
  }

  await createNotification({
    recipient: employeeId,
    sender: sender._id,
    type,
    message,
    document: docId
  });

  if (emailTemplate && employeeEmail) {
    sendEmail(employeeEmail, emailTemplate.subject, emailTemplate.html).catch(() => {});
  }
};

module.exports = {
  setIO,
  registerSocket,
  removeSocket,
  getSocketId,
  createNotification,
  notifyManagers,
  notifyDirectors,
  notifyEmployee
};
