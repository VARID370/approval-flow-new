const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, updateProfile, changePassword, uploadAvatar } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { registerValidation, loginValidation, updateProfileValidation, changePasswordValidation } = require('../middleware/validate');
const { uploadProfile } = require('../config/multer');

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileValidation, updateProfile);
router.put('/password', protect, changePasswordValidation, changePassword);
router.put('/avatar', protect, uploadProfile.single('avatar'), uploadAvatar);

module.exports = router;
