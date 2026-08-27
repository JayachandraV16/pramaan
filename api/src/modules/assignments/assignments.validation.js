const ASSIGNMENT_STATUSES = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  REASSIGNED: 'REASSIGNED',
  COMPLETED: 'COMPLETED',
});

const createAssignmentRules = {
  applicationId: { required: true, type: 'string' },
  assignedToId: { required: true, type: 'string' },
  remarks: { required: false, type: 'string' },
};

const updateAssignmentStatusRules = {
  status: { required: true, type: 'string' },
  remarks: { required: false, type: 'string' },
};

function isValidAssignmentStatus(status) {
  return Object.values(ASSIGNMENT_STATUSES).includes(status);
}

module.exports = {
  ASSIGNMENT_STATUSES,
  createAssignmentRules,
  updateAssignmentStatusRules,
  isValidAssignmentStatus,
};