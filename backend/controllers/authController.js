const User = require('../models/User');
const Activity = require('../models/Activity');
const { sendResponse, sanitizeUser } = require('../utils/helpers');
const { ROLES, ACTIVITY_TYPES } = require('../utils/constants');
const { sendEmail, emailTemplates } = require('../services/emailService');
const fs = require('fs');
const path = require('path');

const register = async (req, res, next) => {
  try {
    const { name, email, password, department } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendResponse(res, 400, false, 'Email is already registered.');
    }

    const user = await User.create({
      name,
      email,
      password,
      department,
      role: ROLES.EMPLOYEE
    });

    await Activity.create({
      user: user._id,
      action: ACTIVITY_TYPES.REGISTER,
      details: `New user registered: ${name} (${email})`,
      ipAddress: req.ip
    });

    const template = emailTemplates.welcome(name);
    sendEmail(email, template.subject, template.html).catch(() => {});

    const token = user.generateToken();

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    sendResponse(res, 201, true, 'Registration successful.', {
      user: sanitizeUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return sendResponse(res, 401, false, 'Invalid email or password.');
    }

    if (!user.isActive) {
      return sendResponse(res, 403, false, 'Your account has been deactivated. Contact admin.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendResponse(res, 401, false, 'Invalid email or password.');
    }

    await Activity.create({
      user: user._id,
      action: ACTIVITY_TYPES.LOGIN,
      details: `User logged in: ${user.name}`,
      ipAddress: req.ip
    });

    const token = user.generateToken();

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    sendResponse(res, 200, true, 'Login successful.', {
      user: sanitizeUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.LOGOUT,
      details: `User logged out: ${req.user.name}`,
      ipAddress: req.ip
    });

    res.cookie('token', 'none', {
      httpOnly: true,
      expires: new Date(0)
    });

    sendResponse(res, 200, true, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    sendResponse(res, 200, true, 'User profile retrieved.', { user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (email && email !== req.user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return sendResponse(res, 400, false, 'Email is already in use.');
      }
      updates.email = email;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true
    });

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.PROFILE_UPDATE,
      details: `Profile updated by ${user.name}`,
      ipAddress: req.ip
    });

    sendResponse(res, 200, true, 'Profile updated successfully.', { user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendResponse(res, 400, false, 'Current password is incorrect.');
    }

    user.password = newPassword;
    await user.save();

    await Activity.create({
      user: req.user._id,
      action: ACTIVITY_TYPES.PASSWORD_CHANGE,
      details: `Password changed by ${user.name}`,
      ipAddress: req.ip
    });

    const token = user.generateToken();

    sendResponse(res, 200, true, 'Password changed successfully.', { token });
  } catch (error) {
    next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendResponse(res, 400, false, 'Please upload an image file.');
    }

    if (req.user.avatar) {
      const oldPath = path.join(__dirname, '..', req.user.avatar);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const avatarPath = `/uploads/profile/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarPath },
      { new: true }
    );

    sendResponse(res, 200, true, 'Avatar uploaded successfully.', { user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  uploadAvatar
};
