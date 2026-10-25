// api/src/middleware/rbacMiddleware.js
//
// Role guard. MUST run after authMiddleware.js (relies on req.user).
//
// Usage:
//   const authorize = require('../../middleware/rbacMiddleware');
//   const { ROLES } = require('../../config/roles');
//   router.post('/assign', authenticate, authorize(ROLES.ADMIN), handler);

const ApiError = require('../utils/ApiError');

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // Programmer error, not a client error — authorize() used without authenticate()
      return next(ApiError.internal('authorize() used without authenticate() first'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = authorize;
