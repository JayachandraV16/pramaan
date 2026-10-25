// api/src/utils/asyncHandler.js
//
// Wraps an async controller/route function so a thrown error or rejected
// promise is forwarded to next(err) instead of crashing the process or
// hanging the request. Use this on every async route handler.
//
// Usage: router.post('/login', asyncHandler(controller.login))

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
