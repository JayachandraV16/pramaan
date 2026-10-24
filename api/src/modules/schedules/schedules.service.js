const ApiError = require('../../utils/ApiError');
const repo = require('./schedules.repository');
const {
  isValidScheduleStatus,
} = require('./schedules.validation');
const { ROLES } = require('../../config/roles');
const { withTransaction } = require('../../utils/db');
const { transition } = require('../../utils/applicationStatus');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');

// SCHEDULED/RESCHEDULED -> RESCHEDULED | COMPLETED | CANCELLED ; COMPLETED/CANCELLED are final.
const ALLOWED_STATUS_CHANGES = Object.freeze({
  SCHEDULED: ['RESCHEDULED', 'COMPLETED', 'CANCELLED'],
  RESCHEDULED: ['RESCHEDULED', 'COMPLETED', 'CANCELLED'],
});

function todayString() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

function assertValidFutureDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw ApiError.badRequest(`${label} must be a date in YYYY-MM-DD format`);
  }
  if (value < todayString()) {
    throw ApiError.badRequest(`${label} cannot be in the past`);
  }
}

// An officer cannot be booked twice for the same date and time slot.
async function assertNoOfficerConflict(client, { assigneeId, date, time, excludeScheduleId = null }) {
  if (!time) return;
  const { rows } = await client.query(
    `SELECT vs.id
     FROM verification_schedules vs
     JOIN verification_assignments va ON va.id = vs.assignment_id
     WHERE va.assigned_to_id = $1
       AND vs.scheduled_date = $2::date
       AND vs.scheduled_time = $3::time
       AND vs.status IN ('SCHEDULED', 'RESCHEDULED')
       AND ($4::uuid IS NULL OR vs.id <> $4::uuid)
     LIMIT 1`,
    [assigneeId, date, time, excludeScheduleId]
  );
  if (rows.length > 0) {
    throw ApiError.conflict('This officer already has a verification at that date and time');
  }
}

async function notifyScheduleParties(client, { applicationId, assigneeId, actorId, title, verb, date, time, location }) {
  const { rows } = await client.query(
    'SELECT applicant_id, application_number FROM verification_applications WHERE id = $1',
    [applicationId]
  );
  const application = rows[0];
  if (!application) return;

  const when = `${date}${time ? ` at ${time}` : ''}${location ? `, ${location}` : ''}`;
  const message = `Verification for application ${application.application_number} is ${verb} ${when}.`;
  for (const recipientId of new Set([application.applicant_id, assigneeId])) {
    if (recipientId === actorId) continue;
    await notify(client, {
      recipientId,
      type: 'VERIFICATION_SCHEDULED',
      title,
      message,
      relatedApplicationId: applicationId,
    });
  }
}

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

  if (assignment.status === 'REASSIGNED') {
    throw ApiError.badRequest('Cannot schedule an assignment that has been reassigned');
  }

  assertValidFutureDate(data.scheduledDate, 'scheduledDate');

  return withTransaction(async (client) => {
    await assertNoOfficerConflict(client, {
      assigneeId: assignment.assigned_to_id,
      date: data.scheduledDate,
      time: data.scheduledTime,
    });

    const schedule = await repo.createSchedule({
      applicationId: data.applicationId,
      assignmentId: data.assignmentId,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      verificationLocation: data.verificationLocation,
      remarks: data.remarks,
    }, client);

    await transition(client, data.applicationId, 'SCHEDULED', {
      actorId: user.id,
      reason: `Scheduled for ${data.scheduledDate}`,
    });

    await audit.record(client, {
      actorId: user.id,
      action: 'SCHEDULE_CREATED',
      entityType: 'schedule',
      entityId: schedule.id,
      details: {
        applicationId: data.applicationId,
        assigneeId: assignment.assigned_to_id,
        date: data.scheduledDate,
        time: data.scheduledTime || null,
      },
    });

    await notifyScheduleParties(client, {
      applicationId: data.applicationId,
      assigneeId: assignment.assigned_to_id,
      actorId: user.id,
      title: 'Verification scheduled',
      verb: 'scheduled for',
      date: data.scheduledDate,
      time: data.scheduledTime,
      location: data.verificationLocation,
    });

    return schedule;
  });
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

  if (schedule.status === data.status && data.status !== 'RESCHEDULED') {
    return schedule;
  }
  const allowed = ALLOWED_STATUS_CHANGES[schedule.status] || [];
  if (!allowed.includes(data.status)) {
    throw ApiError.conflict(
      `A schedule that is ${schedule.status} cannot be changed to ${data.status}`
    );
  }

  const rescheduling = data.status === 'RESCHEDULED';
  if (rescheduling) {
    if (!data.scheduledDate) {
      throw ApiError.badRequest('scheduledDate is required to reschedule');
    }
    assertValidFutureDate(data.scheduledDate, 'scheduledDate');
  }

  return withTransaction(async (client) => {
    if (rescheduling) {
      await assertNoOfficerConflict(client, {
        assigneeId: schedule.assigned_to_id,
        date: data.scheduledDate,
        time: data.scheduledTime,
        excludeScheduleId: scheduleId,
      });
    }

    const { rows } = await client.query(
      `UPDATE verification_schedules
       SET status = $2,
           remarks = COALESCE($3, remarks),
           scheduled_date = COALESCE($4::date, scheduled_date),
           scheduled_time = CASE WHEN $4::date IS NULL THEN scheduled_time ELSE $5::time END
       WHERE id = $1
       RETURNING *`,
      [
        scheduleId,
        data.status,
        data.remarks || null,
        rescheduling ? data.scheduledDate : null,
        rescheduling ? data.scheduledTime || null : null,
      ]
    );

    await audit.record(client, {
      actorId: user.id,
      action: `SCHEDULE_${data.status}`,
      entityType: 'schedule',
      entityId: scheduleId,
      details: {
        from: schedule.status,
        previousDate: schedule.scheduled_date,
        previousTime: schedule.scheduled_time,
        newDate: rescheduling ? data.scheduledDate : null,
        newTime: rescheduling ? data.scheduledTime || null : null,
        remarks: data.remarks || null,
      },
    });

    if (rescheduling) {
      await notifyScheduleParties(client, {
        applicationId: schedule.application_id,
        assigneeId: schedule.assigned_to_id,
        actorId: user.id,
        title: 'Verification rescheduled',
        verb: 'rescheduled to',
        date: data.scheduledDate,
        time: data.scheduledTime,
        location: schedule.verification_location,
      });
    }

    return rows[0];
  });
}

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateScheduleStatus,
};