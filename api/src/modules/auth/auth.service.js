// api/src/modules/auth/auth.service.js

const ApiError = require('../../utils/ApiError');
const { hashPassword, comparePassword, DUMMY_HASH } = require('../../utils/password');
const { signToken } = require('../../utils/jwt');
const repo = require('./auth.repository');
const { isValidRole, isValidApplicantType } = require('./auth.validation');
const { ROLES } = require('../../config/roles');
const { validatePasswordStrength } = require('../../utils/passwordPolicy');
const audit = require('../../utils/audit');

async function register({
  fullName,
  email,
  phone,
  password,
  role,
  organizationName,
  address,
  lcrNumber,
  applicantType,
}) {
  if (!isValidRole(role)) {
    throw ApiError.badRequest(`Invalid role: ${role}`);
  }

  // Public sign-up rules:
  //   INSTRUMENT_OWNER / PUBLIC_USER  -> active immediately
  //   LMO / GATC                      -> allowed, but PENDING_APPROVAL until an
  //                                      ADMIN approves (no token is issued)
  //   ADMIN                           -> never self-registrable
  if (role === ROLES.ADMIN) {
    throw ApiError.forbidden('Administrator accounts can only be created by an existing administrator');
  }
  const needsApproval = role === ROLES.LMO || role === ROLES.GATC;

  validatePasswordStrength(password);

  // Mirrors the DB's ck_users_email_or_phone constraint — fail fast with a
  // clear message instead of letting the INSERT bounce with a raw
  // constraint-violation error.
  if (!email && !phone) {
    throw ApiError.badRequest('Either email or phone is required');
  }

  if (applicantType && !isValidApplicantType(applicantType)) {
    throw ApiError.badRequest(`Invalid applicant type: ${applicantType}`);
  }

  if (email) {
    const existing = await repo.findUserByEmail(email);
    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }
  }

  const roleId = await repo.findRoleIdByName(role);
  if (!roleId) {
    // Role string passed isValidRole() but has no matching row in `roles` —
    // means the roles table isn't seeded yet. Different problem than bad
    // input, so it's a 500, not a 400.
    throw ApiError.internal(
      `Role "${role}" is not seeded in the roles table. Run the roles seed script first.`
    );
  }

  // lcrNumber/applicantType only apply to instrument owners — other roles
  // (LMO/GATC/Admin/Public) never persist them, even if sent.
  const isOwner = role === ROLES.INSTRUMENT_OWNER;

  const passwordHash = await hashPassword(password);
  const user = await repo.createUser({
    fullName,
    email,
    phone,
    passwordHash,
    roleId,
    organizationName,
    address,
    lcrNumber: isOwner ? lcrNumber : null,
    applicantType: isOwner ? applicantType : null,
    status: needsApproval ? 'PENDING_APPROVAL' : 'ACTIVE',
  });

  if (needsApproval) {
    await audit.recordStandalone({
      actorId: user.id,
      action: 'STAFF_REGISTRATION_SUBMITTED',
      entityType: 'user',
      entityId: user.id,
      details: { role },
    });
    return { user: { ...user, role }, token: null, pendingApproval: true };
  }

  const token = signToken({ id: user.id, role });
  return { user: { ...user, role }, token };
}

async function login({ email, password }) {
  const user = await repo.findUserByEmail(email);

  // Always run one bcrypt comparison (against a dummy hash if the account
  // does not exist) so response time does not reveal which emails exist, and
  // check the password BEFORE the account status so status is only disclosed
  // to someone who knows the password.
  const isMatch = await comparePassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.status === 'PENDING_APPROVAL') {
    throw ApiError.forbidden('Your account is awaiting administrator approval');
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden(`Account is ${user.status.toLowerCase()}`);
  }

  const token = signToken({ id: user.id, role: user.role });
  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token };
}

async function getProfile(userId) {
  const user = await repo.findUserById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user;
}

module.exports = { register, login, getProfile };