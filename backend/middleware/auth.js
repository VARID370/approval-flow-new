const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendResponse } = require('../utils/helpers');

const protect = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return sendResponse(res, 401, false, 'Not authorized. No token provided.');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return sendResponse(res, 401, false, 'User no longer exists.');
    }

    if (!user.isActive) {
      return sendResponse(res, 403, false, 'Your account has been deactivated. Contact admin.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return sendResponse(res, 401, false, 'Invalid token.');
    }
    if (error.name === 'TokenExpiredError') {
      return sendResponse(res, 401, false, 'Token has expired. Please login again.');
    }
    return sendResponse(res, 500, false, 'Authentication error.');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendResponse(res, 403, false, `Role '${req.user.role}' is not authorized to access this resource.`);
    }
    next();
  };
};

const departmentAccess = (req, res, next) => {
  if (req.user.role === 'Admin') {
    return next();
  }
  if (req.document && req.document.department !== req.user.department) {
    return sendResponse(res, 403, false, 'You can only access documents from your own department.');
  }
  next();
};

module.exports = { protect, authorize, departmentAccess };
