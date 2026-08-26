// api/src/middleware/authMiddleware.js
//
// Verifies the "Authorization: Bearer <token>" header and attaches
// req.user = { id, role } for downstream handlers and rbacMiddleware.js.
// Any protected route in any module should start with this middleware.

const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  const token = header.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

module.exports = authenticate;
