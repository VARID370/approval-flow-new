const ROLES = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  DIRECTOR: 'Director',
  ADMIN: 'Admin'
};

const DEPARTMENTS = [
  'Engineering',
  'Finance',
  'Sales',
  'Marketing',
  'HR',
  'Legal',
  'Operations'
];

const DOCUMENT_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'UnderReview',
  MANAGER_APPROVED: 'ManagerApproved',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  REVISION_REQUESTED: 'RevisionRequested'
};

const ACTIVITY_TYPES = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  UPLOAD: 'Upload',
  DOWNLOAD: 'Download',
  APPROVE: 'Approve',
  REJECT: 'Reject',
  REVISION: 'Revision',
  DELETE: 'Delete',
  SUBMIT: 'Submit',
  UPDATE: 'Update',
  REGISTER: 'Register',
  PROFILE_UPDATE: 'ProfileUpdate',
  PASSWORD_CHANGE: 'PasswordChange',
  ROLE_CHANGE: 'RoleChange',
  STATUS_CHANGE: 'StatusChange'
};

const NOTIFICATION_TYPES = {
  NEW_UPLOAD: 'NewUpload',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REVISION: 'Revision',
  COMPLETED: 'Completed',
  SUBMITTED: 'Submitted',
  ROLE_CHANGED: 'RoleChanged',
  ACCOUNT_STATUS: 'AccountStatus'
};

const COMMENT_ACTIONS = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  REVISION: 'Revision',
  COMMENT: 'Comment'
};

module.exports = {
  ROLES,
  DEPARTMENTS,
  DOCUMENT_STATUS,
  ACTIVITY_TYPES,
  NOTIFICATION_TYPES,
  COMMENT_ACTIONS
};
