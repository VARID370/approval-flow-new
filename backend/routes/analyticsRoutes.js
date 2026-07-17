const express = require('express');
const router = express.Router();
const { getDashboardStats, getAnalytics } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

router.get('/dashboard', protect, getDashboardStats);
router.get('/full', protect, authorize(ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER), getAnalytics);

module.exports = router;
