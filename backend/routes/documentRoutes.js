const express = require('express');
const router = express.Router();
const {
  uploadDocument, getMyDocuments, getDocument, updateDraft, deleteDraft,
  submitDocument, getPendingDocuments, getApprovalHistory, approveDocument,
  rejectDocument, requestRevision, downloadDocument, getAllDocuments
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/auth');
const { documentValidation, approvalActionValidation, mongoIdValidation } = require('../middleware/validate');
const { uploadDocument: multerUpload } = require('../config/multer');
const { ROLES } = require('../utils/constants');

router.post('/upload', protect, authorize(ROLES.EMPLOYEE), multerUpload.single('file'), documentValidation, uploadDocument);
router.get('/my', protect, authorize(ROLES.EMPLOYEE), getMyDocuments);
router.get('/pending', protect, authorize(ROLES.MANAGER, ROLES.DIRECTOR, ROLES.ADMIN), getPendingDocuments);
router.get('/history', protect, authorize(ROLES.MANAGER, ROLES.DIRECTOR, ROLES.ADMIN), getApprovalHistory);
router.get('/all', protect, authorize(ROLES.ADMIN), getAllDocuments);
router.get('/:id', protect, mongoIdValidation, getDocument);
router.put('/:id', protect, authorize(ROLES.EMPLOYEE), multerUpload.single('file'), updateDraft);
router.delete('/:id', protect, authorize(ROLES.EMPLOYEE, ROLES.ADMIN), mongoIdValidation, deleteDraft);
router.put('/:id/submit', protect, authorize(ROLES.EMPLOYEE), mongoIdValidation, submitDocument);
router.put('/:id/approve', protect, authorize(ROLES.MANAGER, ROLES.DIRECTOR, ROLES.ADMIN), approvalActionValidation, approveDocument);
router.put('/:id/reject', protect, authorize(ROLES.MANAGER, ROLES.DIRECTOR, ROLES.ADMIN), approvalActionValidation, rejectDocument);
router.put('/:id/revision', protect, authorize(ROLES.MANAGER, ROLES.DIRECTOR, ROLES.ADMIN), approvalActionValidation, requestRevision);
router.get('/:id/download', protect, mongoIdValidation, downloadDocument);

module.exports = router;
