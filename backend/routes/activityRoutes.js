const express = require('express');
const router = express.Router();
const { getActivityLogs, getMyActivity } = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

router.get('/', protect, authorize(ROLES.ADMIN), getActivityLogs);
router.get('/my', protect, getMyActivity);

module.exports = router;
