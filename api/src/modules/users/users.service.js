// api/src/modules/users/users.service.js
//
// Business rules for user administration and profile management.
//   - ADMIN approves/suspends accounts and can create staff accounts.
//   - Any user can edit their own profile and change their own password.
//   - Every status change is written to the audit log in the same
//     transaction as the change.

const pool = require('../../pool');
const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { hashPassword, comparePassword } = require('../../utils/password');
const { validatePasswordStrength } = require('../../utils/passwordPolicy');
const authRepo = require('../auth/auth.repository');
const repo = require('./users.repository');
const { SUPPORTED: SUPPORTED_LANGUAGES } = require('../../utils/i18n');
const { isValidStatus, isValidRole, USER_STATUSES } = require('./users.validation');
const { ROLES } = require('../../config/roles');

const MAX_PAGE_SIZE = 100;

function pageParams(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), MAX_PAGE_SIZE);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}

async function listUsers(query) {
  if (query.status && !isValidStatus(query.status)) {
    throw ApiError.badRequest(`Invalid status: ${query.status}`);
  }
  if (query.role && !isValidRole(query.role)) {
    throw ApiError.badRequest(`Invalid role: ${query.role}`);
  }
  const { limit, page, offset } = pageParams(query);
  const { rows, total } = await repo.list({
    status: query.status,
    role: query.role,
    search: query.search,
    limit,
    offset,
  });
  return { items: rows, page, limit, total };
}

async function getUser(id) {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function createUser(actor, data) {
  if (!isValidRole(data.role)) {
    throw ApiError.badRequest(`Invalid role: ${data.role}`);
  }
  if (!data.email && !data.phone) {
    throw ApiError.badRequest('Either email or phone is required');
  }
  validatePasswordStrength(data.password);

  if (data.email && (await authRepo.findUserByEmail(data.email))) {
    throw ApiError.conflict('An account with this email already exists');
  }
  const roleId = await authRepo.findRoleIdByName(data.role);
  if (!roleId) throw ApiError.internal(`Role "${data.role}" is not seeded`);

  const passwordHash = await hashPassword(data.password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await authRepo.createUser(
      {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        passwordHash,
        roleId,
        organizationName: data.organizationName,
        address: data.address,
        lcrNumber: data.role === ROLES.INSTRUMENT_OWNER ? data.lcrNumber : null,
        applicantType: data.role === ROLES.INSTRUMENT_OWNER ? data.applicantType : null,
        status: USER_STATUSES.ACTIVE,
      },
      client
    );
    await audit.record(client, {
      actorId: actor.id,
      action: 'USER_CREATED_BY_ADMIN',
      entityType: 'user',
      entityId: user.id,
      details: { role: data.role },
    });
    await client.query('COMMIT');
    return { ...user, role: data.role };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateStatus(actor, userId, status) {
  if (!isValidStatus(status)) {
    throw ApiError.badRequest(`Invalid status: ${status}`);
  }
  if (userId === actor.id) {
    throw ApiError.badRequest('You cannot change your own account status');
  }
  const target = await repo.findById(userId);
  if (!target) throw ApiError.notFound('User not found');

  // PENDING_APPROVAL is only ever the starting state of a self-registration.
  if (status === USER_STATUSES.PENDING_APPROVAL) {
    throw ApiError.badRequest('PENDING_APPROVAL cannot be set manually');
  }
  if (target.status === status) return target;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await repo.setStatus(client, userId, status);
    await audit.record(client, {
      actorId: actor.id,
      action: 'USER_STATUS_CHANGED',
      entityType: 'user',
      entityId: userId,
      details: { from: target.status, to: status, role: target.role },
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return repo.findById(userId);
}

async function updateOwnProfile(userId, data) {
  if (data.preferredLanguage !== undefined && !SUPPORTED_LANGUAGES.includes(data.preferredLanguage)) {
    throw ApiError.badRequest(`preferredLanguage must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
  await repo.updateProfile(userId, data);
  return repo.findById(userId);
}

async function changeOwnPassword(userId, { currentPassword, newPassword }) {
  const currentHash = await repo.findPasswordHashById(userId);
  if (!currentHash || !(await comparePassword(currentPassword, currentHash))) {
    throw ApiError.unauthorized('Current password is incorrect');
  }
  validatePasswordStrength(newPassword);
  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password must differ from the current password');
  }

  const newHash = await hashPassword(newPassword);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await repo.setPasswordHash(client, userId, newHash);
    await audit.record(client, {
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'user',
      entityId: userId,
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateStatus,
  updateOwnProfile,
  changeOwnPassword,
};
