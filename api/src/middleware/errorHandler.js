// api/src/middleware/errorHandler.js
//
// Central error handler. MUST be the last app.use(...) in app.js — Express
// only treats a 4-arg function as an error handler, and only errors that
// happen after it's registered will reach it.
//
// Operational errors (ApiError, isOperational = true) return their own
// status + message. Anything else (a real bug) is logged with a stack
// trace and returned to the client as a generic 500 — we never leak
// internal error details to the client in production.

const logger = require('../utils/logger');
const config = require('../config');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  if (!isOperational || statusCode >= 500) {
    logger.error(err.message, err.stack);
  } else {
    logger.warn(`${statusCode} ${req.method} ${req.originalUrl} — ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : 'Something went wrong',
    ...(err.details ? { details: err.details } : {}),
    ...(config.env === 'development' && !isOperational ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
