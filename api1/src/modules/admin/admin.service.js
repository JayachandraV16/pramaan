const ApiError = require('../../utils/ApiError');
const repo = require('./admin.repository');
const { ROLES } = require('../../config/roles');

async function getActiveOfficers(user) {
  if (user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only ADMIN can list inspector officers');
  }

  return repo.findActiveOfficers();
}

module.exports = { getActiveOfficers };