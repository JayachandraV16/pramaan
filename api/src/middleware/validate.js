// api/src/middleware/validate.js
//
// Lightweight body validator. Deliberately dependency-free (no zod/Joi) to
// keep the Stage 0 package footprint small. Good enough for flat request
// bodies like register/login. If a module later needs nested-object or
// array validation, that's a real justification to add a schema library —
// raise it as a dependency-hygiene check first, don't just add it.
//
// Usage:
//   validateBody({ email: { required: true, type: 'string' } })

const ApiError = require('../utils/ApiError');

function validateBody(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body ? req.body[field] : undefined;

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      if (value !== undefined && rule.type && typeof value !== rule.type) {
        errors.push(`${field} must be of type ${rule.type}`);
      }
    }

    if (errors.length > 0) {
      return next(ApiError.badRequest('Validation failed', errors));
    }
    next();
  };
}

module.exports = validateBody;
