// api/src/modules/auth/auth.service.js

const ApiError = require('../../utils/ApiError');
const { hashPassword, comparePassword } = require('../../utils/password');
const { signToken } = require('../../utils/jwt');
const repo = require('./auth.repository');
const { isValidRole, isValidApplicantType } = require('./auth.validation');
const { ROLES } = require('../../config/roles');

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
  });

  const token = signToken({ id: user.id, role });
  return { user: { ...user, role }, token };
}

async function login({ email, password }) {
  const user = await repo.findUserByEmail(email);
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden(`Account is ${user.status.toLowerCase()}`);
  }

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
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