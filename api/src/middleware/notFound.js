// api/src/middleware/notFound.js
//
// Catches any request that didn't match a route. Mount this AFTER all
// module routes and BEFORE errorHandler.js in app.js.

const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
