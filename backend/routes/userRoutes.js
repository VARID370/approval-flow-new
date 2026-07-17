const express = require('express');
const router = express.Router();
const { getAllUsers, getUser, updateUserRole, toggleUserStatus, deleteUser, createUser, updateUser, resetUserPassword } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { userRoleValidation, mongoIdValidation } = require('../middleware/validate');
const { ROLES } = require('../utils/constants');

router.get('/', protect, authorize(ROLES.ADMIN), getAllUsers);
router.post('/', protect, authorize(ROLES.ADMIN), createUser);
router.get('/:id', protect, authorize(ROLES.ADMIN), mongoIdValidation, getUser);
router.put('/:id', protect, authorize(ROLES.ADMIN), mongoIdValidation, updateUser);
router.put('/:id/role', protect, authorize(ROLES.ADMIN), userRoleValidation, updateUserRole);
router.put('/:id/toggle-status', protect, authorize(ROLES.ADMIN), mongoIdValidation, toggleUserStatus);
router.put('/:id/reset-password', protect, authorize(ROLES.ADMIN), mongoIdValidation, resetUserPassword);
router.delete('/:id', protect, authorize(ROLES.ADMIN), mongoIdValidation, deleteUser);

module.exports = router;
