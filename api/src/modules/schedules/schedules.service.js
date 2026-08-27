const ApiError = require('../../utils/ApiError');
const repo = require('./schedules.repository');
const {
  isValidScheduleStatus,
} = require('./schedules.validation');
const { ROLES } = require('../../config/roles');

async function createSchedule(user, data) {
  const assignment = await repo.findAssignmentById(
    data.assignmentId
  );

  if (!assignment) {
    throw ApiError.notFound('Assignment not found');
  }

  // The assignment must belong to the provided application
  if (assignment.application_id !== data.applicationId) {
    throw ApiError.badRequest(
      'Assignment does not belong to the specified application'
    );
  }

  // Cannot schedule assignments that are declined or completed
  if (
    assignment.status === 'DECLINED' ||
    assignment.status === 'COMPLETED'
  ) {
    throw ApiError.badRequest(
      `Cannot schedule an assignment with status ${assignment.status}`
    );
  }

  const schedule = await repo.createSchedule({
  applicationId: data.applicationId,
  assignmentId: data.assignmentId,
  scheduledDate: data.scheduledDate,
  scheduledTime: data.scheduledTime,
  verificationLocation: data.verificationLocation,
  remarks: data.remarks,
  });

  await repo.updateApplicationStatus(
    data.applicationId,
    'SCHEDULED'
  );

  return schedule;
}

async function getSchedules(user) {
  if (user.role === ROLES.ADMIN) {
    return repo.findAllSchedules();
  }

  return repo.findSchedulesByAssigneeId(user.id);
}

async function getScheduleById(user, scheduleId) {
  const schedule = await repo.findScheduleById(scheduleId);

  if (!schedule) {
    throw ApiError.notFound('Schedule not found');
  }

  // ADMIN can access all schedules
  if (user.role === ROLES.ADMIN) {
    return schedule;
  }

  // LMO/GATC can access only their schedules
  if (schedule.assigned_to_id !== user.id) {
    throw ApiError.forbidden(
      'You do not have permission to access this schedule'
    );
  }

  return schedule;
}

async function updateScheduleStatus(
  user,
  scheduleId,
  data
) {
  if (!isValidScheduleStatus(data.status)) {
    throw ApiError.badRequest(
      `Invalid schedule status: ${data.status}`
    );
  }

  const schedule = await repo.findScheduleById(scheduleId);

  if (!schedule) {
    throw ApiError.notFound('Schedule not found');
  }

  // ADMIN can update any schedule
  // LMO/GATC can update only their own schedules
  if (
    user.role !== ROLES.ADMIN &&
    schedule.assigned_to_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You can only update schedules assigned to you'
    );
  }

  return repo.updateScheduleStatus(
    scheduleId,
    data.status,
    data.remarks
  );
}

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateScheduleStatus,
};