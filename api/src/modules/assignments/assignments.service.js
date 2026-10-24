const ApiError = require('../../utils/ApiError');
const repo = require('./assignments.repository');
const documentsService = require('../documents/documents.service');
const {
  ASSIGNMENT_STATUSES,
  isValidAssignmentStatus,
} = require('./assignments.validation');
const { ROLES } = require('../../config/roles');
const config = require('../../config');
const { withTransaction } = require('../../utils/db');
const { transition } = require('../../utils/applicationStatus');
const audit = require('../../utils/audit');
const { notify } = require('../../utils/notify');

// ASSIGNED -> ACCEPTED | DECLINED ; ACCEPTED -> DECLINED. Everything else is final.
const ALLOWED_STATUS_CHANGES = Object.freeze({
  ASSIGNED: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['DECLINED'],
});

async function createAssignment(user, data) {
  const application = await repo.findApplicationById(
    data.applicationId
  );

  if (!application) {
    throw ApiError.notFound('Application not found');
  }

  // Don't assign applications that are already completed/rejected/cancelled
  if (
    application.status === 'COMPLETED' ||
    application.status === 'REJECTED' ||
    application.status === 'CANCELLED'
  ) {
    throw ApiError.badRequest(
      `Cannot assign an application with status ${application.status}`
    );
  }

  if (config.requirePaymentBeforeAssignment && !application.payment_verified_at) {
    throw ApiError.conflict(
      'The fee payment for this application has not been verified yet'
    );
  }

  await documentsService.assertRequirementsMet(application.id);

  const assignee = await repo.findUserById(
    data.assignedToId
  );

  if (!assignee) {
    throw ApiError.notFound('Assigned user not found');
  }

  if (
    assignee.role !== ROLES.LMO &&
    assignee.role !== ROLES.GATC
  ) {
    throw ApiError.badRequest(
      'Assigned user must have role LMO or GATC'
    );
  }

  if (assignee.status !== 'ACTIVE') {
    throw ApiError.badRequest(
      'Assigned user account is not active'
    );
  }

  return withTransaction(async (client) => {
    // Lock the application so two admins cannot assign it at the same moment.
    await client.query(
      'SELECT id FROM verification_applications WHERE id = $1 FOR UPDATE',
      [data.applicationId]
    );

    const { rows: started } = await client.query(
      'SELECT 1 FROM verifications WHERE application_id = $1 LIMIT 1',
      [data.applicationId]
    );
    if (started.length > 0) {
      throw ApiError.conflict('A verification has already started for this application; it cannot be reassigned');
    }

    // Re-assignment: retire the previous active assignment(s) and their open schedules.
    const { rows: retired } = await client.query(
      `UPDATE verification_assignments
       SET status = 'REASSIGNED',
           remarks = COALESCE(remarks || ' | ', '') || 'Reassigned'
       WHERE application_id = $1 AND status IN ('ASSIGNED', 'ACCEPTED')
       RETURNING id, assigned_to_id`,
      [data.applicationId]
    );
    if (retired.length > 0) {
      await client.query(
        `UPDATE verification_schedules SET status = 'CANCELLED'
         WHERE assignment_id = ANY($1::uuid[]) AND status IN ('SCHEDULED', 'RESCHEDULED')`,
        [retired.map((r) => r.id)]
      );
    }

    const assignment = await repo.createAssignment({
      applicationId: data.applicationId,
      assignedToId: data.assignedToId,
      assignedById: user.id,
      remarks: data.remarks,
    }, client);

    await transition(client, data.applicationId, 'UNDER_REVIEW', {
      actorId: user.id,
      reason: retired.length > 0 ? 'Reassigned to another officer' : 'Assigned to an officer',
    });

    await audit.record(client, {
      actorId: user.id,
      action: retired.length > 0 ? 'ASSIGNMENT_REASSIGNED' : 'ASSIGNMENT_CREATED',
      entityType: 'application',
      entityId: data.applicationId,
      details: { assignmentId: assignment.id, assignedToId: data.assignedToId },
    });

    await notify(client, {
      recipientId: data.assignedToId,
      type: 'APPLICATION_UPDATE',
      key: 'assignment.new',
      params: { applicationNumber: application.application_number },
      relatedApplicationId: data.applicationId,
    });

    return assignment;
  });
}

async function getAssignments(user) {
  if (user.role === ROLES.ADMIN) {
    return repo.findAllAssignments();
  }

  return repo.findAssignmentsByAssigneeId(user.id);
}

async function getAssignmentById(user, assignmentId) {
  const assignment = await repo.findAssignmentById(
    assignmentId
  );

  if (!assignment) {
    throw ApiError.notFound('Assignment not found');
  }

  // ADMIN can access everything
  if (user.role === ROLES.ADMIN) {
    return assignment;
  }

  // LMO/GATC can only access assignments given to them
  if (assignment.assigned_to_id !== user.id) {
    throw ApiError.forbidden(
      'You do not have permission to access this assignment'
    );
  }

  return assignment;
}

async function updateAssignmentStatus(
  user,
  assignmentId,
  data
) {
  if (!isValidAssignmentStatus(data.status)) {
    throw ApiError.badRequest(
      `Invalid assignment status: ${data.status}`
    );
  }

  const assignment = await repo.findAssignmentById(
    assignmentId
  );

  if (!assignment) {
    throw ApiError.notFound('Assignment not found');
  }

  // Only the assigned LMO/GATC can update their assignment
  if (
    user.role !== ROLES.ADMIN &&
    assignment.assigned_to_id !== user.id
  ) {
    throw ApiError.forbidden(
      'You can only update assignments assigned to you'
    );
  }

  if (assignment.status === data.status) {
    return assignment;
  }

  // Officers decide on a new assignment; COMPLETED is set by the system when
  // the verification result is submitted and REASSIGNED by assigning again.
  const allowed = ALLOWED_STATUS_CHANGES[assignment.status] || [];
  if (!allowed.includes(data.status)) {
    throw ApiError.conflict(
      `An assignment that is ${assignment.status} cannot be changed to ${data.status}`
    );
  }

  return withTransaction(async (client) => {
    if (data.status === 'DECLINED') {
      const { rows: started } = await client.query(
        'SELECT 1 FROM verifications WHERE application_id = $1 LIMIT 1',
        [assignment.application_id]
      );
      if (started.length > 0) {
        throw ApiError.conflict('A verification has already started; the assignment cannot be declined');
      }
    }

    const { rows } = await client.query(
      `UPDATE verification_assignments
       SET status = $2, remarks = COALESCE($3, remarks)
       WHERE id = $1
       RETURNING *`,
      [assignmentId, data.status, data.remarks || null]
    );

    await audit.record(client, {
      actorId: user.id,
      action: `ASSIGNMENT_${data.status}`,
      entityType: 'assignment',
      entityId: assignmentId,
      details: { applicationId: assignment.application_id, from: assignment.status, remarks: data.remarks || null },
    });

    if (data.status === 'DECLINED' && assignment.assigned_by_id) {
      await notify(client, {
        recipientId: assignment.assigned_by_id,
        type: 'APPLICATION_UPDATE',
        title: 'Assignment declined',
        message: `An officer declined the assignment${data.remarks ? `: ${data.remarks}` : '.'} Please assign another officer.`,
        relatedApplicationId: assignment.application_id,
      });
    }

    return rows[0];
  });
}

async function getAvailableOfficers() {
  return repo.findAvailableOfficers();
}

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  getAvailableOfficers,
  updateAssignmentStatus,
};