// api/src/modules/users/users.validation.js

const { ROLES } = require('../../config/roles');

const USER_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
});

const createUserRules = {
  fullName: { required: true, type: 'string' },
  password: { required: true, type: 'string' },
  role: { required: true, type: 'string' },
};

const updateStatusRules = {
  status: { required: true, type: 'string' },
};

const updateProfileRules = {
  fullName: { required: false, type: 'string' },
  phone: { required: false, type: 'string' },
  organizationName: { required: false, type: 'string' },
  address: { required: false, type: 'string' },
};

const changePasswordRules = {
  currentPassword: { required: true, type: 'string' },
  newPassword: { required: true, type: 'string' },
};

function isValidStatus(status) {
  return Object.values(USER_STATUSES).includes(status);
}

function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

module.exports = {
  USER_STATUSES,
  createUserRules,
  updateStatusRules,
  updateProfileRules,
  changePasswordRules,
  isValidStatus,
  isValidRole,
};
