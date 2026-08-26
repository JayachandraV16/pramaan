const SCHEDULE_STATUSES = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  RESCHEDULED: 'RESCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const createScheduleRules = {
  applicationId: { required: true, type: 'string' },
  assignmentId: { required: true, type: 'string' },
  scheduledDate: { required: true, type: 'string' },
  scheduledTime: { required: false, type: 'string' },
  verificationLocation: { required: false, type: 'string' },
  remarks: { required: false, type: 'string' },
};

const updateScheduleStatusRules = {
  status: { required: true, type: 'string' },
  remarks: { required: false, type: 'string' },
};

function isValidScheduleStatus(status) {
  return Object.values(SCHEDULE_STATUSES).includes(status);
}

module.exports = {
  SCHEDULE_STATUSES,
  createScheduleRules,
  updateScheduleStatusRules,
  isValidScheduleStatus,
};