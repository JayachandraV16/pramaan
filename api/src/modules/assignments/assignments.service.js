const ApiError = require('../../utils/ApiError');
const repo = require('./assignments.repository');
const {
  ASSIGNMENT_STATUSES,
  isValidAssignmentStatus,
} = require('./assignments.validation');
const { ROLES } = require('../../config/roles');

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

  const assignment = await repo.createAssignment({
  applicationId: data.applicationId,
  assignedToId: data.assignedToId,
  assignedById: user.id,
  remarks: data.remarks,
  });

  await repo.updateApplicationStatus(
    data.applicationId,
    'UNDER_REVIEW'
  );

  return assignment;
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

  return repo.updateAssignmentStatus(
    assignmentId,
    data.status,
    data.remarks
  );
}

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignmentStatus,
};