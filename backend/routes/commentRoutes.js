const express = require('express');
const router = express.Router();
const { addComment, getDocumentComments } = require('../controllers/commentController');
const { protect } = require('../middleware/auth');
const { commentValidation } = require('../middleware/validate');

router.post('/:documentId', protect, commentValidation, addComment);
router.get('/:documentId', protect, getDocumentComments);

module.exports = router;
