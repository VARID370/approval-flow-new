const User = require('../models/User');
const Activity = require('../models/Activity');
const { sendResponse, getPagination, buildPaginationMeta, sanitizeUser } = require('../utils/helpers');
const { ROLES, ACTIVITY_TYPES } = require('../utils/constants');
const { createNotification } = require('../services/notificationService');
const fs = require('fs');
const path = require('path');
const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { buildSortObject } = require('../utils/helpers');
    const sort = buildSortObject(req.query.sort || 'createdAt:desc');
    const filter = {};

    if (req.query.role) filter.role = req.query.role;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);

    const sanitized = users.map(u => sanitizeUser(u));
    sendResponse(res, 200, true, 'Users retrieved.', { users: sanitized }, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendResponse(res, 404, false, 'User not found.');
    }
    sendResponse(res, 200, true, 'User retrieved.', { user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendResponse(res, 404, false, 'User not found.');
    }

    if (user._id.toString() === req.user._id.toString()) {
      return sendResponse(res, 400, false, 'You cannot change your own role.');
    }

    const oldRole = user.role;
    await User.updateOne({ _id: user._id }, { role }, { runValidators: true });
    user.role = role;

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.ROLE_CHANGE,
      target: { targetUser: user._id },
      details: `Role changed for ${user.name}: ${oldRole} → ${role}`,
      ipAddress: req.ip
    });

    await createNotification({
      recipient: user._id,
      sender: req.user._id,
      type: 'RoleChanged',
      message: `Your role has been changed from ${oldRole} to ${role} by admin.`
    });

    sendResponse(res, 200, true, 'User role updated.', { user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendResponse(res, 404, false, 'User not found.');
    }

    if (user._id.toString() === req.user._id.toString()) {
      return sendResponse(res, 400, false, 'You cannot deactivate your own account.');
    }

    const newStatus = !user.isActive;
    await User.updateOne({ _id: user._id }, { isActive: newStatus });
    user.isActive = newStatus;

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.STATUS_CHANGE,
      target: { targetUser: user._id },
      details: `User ${user.name} ${user.isActive ? 'activated' : 'deactivated'}`,
      ipAddress: req.ip
    });

    await createNotification({
      recipient: user._id,
      sender: req.user._id,
      type: 'AccountStatus',
      message: `Your account has been ${user.isActive ? 'activated' : 'deactivated'} by admin.`
    });

    sendResponse(res, 200, true, `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`, { user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendResponse(res, 404, false, 'User not found.');
    }

    if (user._id.toString() === req.user._id.toString()) {
      return sendResponse(res, 400, false, 'You cannot delete your own account.');
    }

    if (user.role === ROLES.ADMIN) {
      return sendResponse(res, 400, false, 'Cannot delete an admin account.');
    }

    if (user.avatar) {
      const avatarPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    await User.findByIdAndDelete(req.params.id);

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.DELETE,
      details: `User ${user.name} (${user.email}) deleted`,
      ipAddress: req.ip
    });

    sendResponse(res, 200, true, 'User deleted successfully.');
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, department, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return sendResponse(res, 400, false, 'Email is already in use.');
    
    const user = await User.create({ name, email, password, department, role: role || ROLES.EMPLOYEE });
    await Activity.create({
      user: req.user._id, action: ACTIVITY_TYPES.REGISTER,
      details: `Created new user ${name} (${role})`, ipAddress: req.ip
    });
    sendResponse(res, 201, true, 'User created successfully.', { user: sanitizeUser(user) });
  } catch (error) { next(error); }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, email, department } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return sendResponse(res, 404, false, 'User not found.');
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) return sendResponse(res, 400, false, 'Email is already in use.');
      user.email = email;
    }
    if (name) user.name = name;
    if (department) user.department = department;
    await user.save();
    
    await Activity.create({
      user: req.user._id, action: ACTIVITY_TYPES.UPDATE,
      target: { targetUser: user._id },
      details: `Updated details for ${user.name}`, ipAddress: req.ip
    });
    sendResponse(res, 200, true, 'User updated successfully.', { user: sanitizeUser(user) });
  } catch (error) { next(error); }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return sendResponse(res, 400, false, 'Password is required.');
    
    const user = await User.findById(req.params.id);
    if (!user) return sendResponse(res, 404, false, 'User not found.');
    
    user.password = password;
    await user.save();
    
    await Activity.create({
      user: req.user._id, action: ACTIVITY_TYPES.PASSWORD_CHANGE,
      target: { targetUser: user._id },
      details: `Reset password for ${user.name}`, ipAddress: req.ip
    });
    sendResponse(res, 200, true, 'User password reset successfully.');
  } catch (error) { next(error); }
};

module.exports = { getAllUsers, getUser, updateUserRole, toggleUserStatus, deleteUser, createUser, updateUser, resetUserPassword };
