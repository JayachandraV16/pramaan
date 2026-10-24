// api/src/middleware/authMiddleware.js
//
// Verifies the "Authorization: Bearer <token>" header and attaches
// req.user = { id, role } for downstream handlers and rbacMiddleware.js.
// Any protected route in any module should start with this middleware.
//
// The signed token proves who the caller is; the CURRENT account status and
// role are read from the database on every request, so suspending a user or
// changing their role takes effect immediately instead of after the token
// expires.

const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');
const pool = require('../pool');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.status, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [decoded.id]
    );
    const account = rows[0];
    if (!account) {
      return next(ApiError.unauthorized('Account no longer exists'));
    }
    if (account.status !== 'ACTIVE') {
      return next(ApiError.forbidden('Account is not active'));
    }

    req.user = { id: decoded.id, role: account.role };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;
