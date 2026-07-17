const { body, param, query, validationResult } = require('express-validator');
const { ROLES, DEPARTMENTS, COMMENT_ACTIONS } = require('../utils/constants');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(err => err.msg);
    return res.status(400).json({
      success: false,
      message: messages.join('. '),
      errors: errors.array()
    });
  }
  next();
};

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain a number'),
  body('department').notEmpty().withMessage('Department is required')
    .isIn(DEPARTMENTS).withMessage('Invalid department'),
  handleValidationErrors
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const updateProfileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').optional().trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  handleValidationErrors
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
    .matches(/\d/).withMessage('New password must contain a number'),
  handleValidationErrors
];

const documentValidation = [
  body('title').trim().notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  handleValidationErrors
];

const approvalActionValidation = [
  body('comment').optional().trim().isLength({ max: 2000 }).withMessage('Comment cannot exceed 2000 characters'),
  param('id').isMongoId().withMessage('Invalid document ID'),
  handleValidationErrors
];

const commentValidation = [
  body('content').trim().notEmpty().withMessage('Comment content is required')
    .isLength({ max: 2000 }).withMessage('Comment cannot exceed 2000 characters'),
  body('action').optional().isIn(Object.values(COMMENT_ACTIONS)).withMessage('Invalid action'),
  param('documentId').isMongoId().withMessage('Invalid document ID'),
  handleValidationErrors
];

const userRoleValidation = [
  body('role').notEmpty().withMessage('Role is required')
    .isIn(Object.values(ROLES)).withMessage('Invalid role'),
  param('id').isMongoId().withMessage('Invalid user ID'),
  handleValidationErrors
];

const mongoIdValidation = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  documentValidation,
  approvalActionValidation,
  commentValidation,
  userRoleValidation,
  mongoIdValidation,
  paginationValidation
};
