// api/src/middleware/security.js
//
// Dependency-free security middleware: response headers, CORS allow-list and
// a small in-memory rate limiter.
//
// The rate limiter is per-process (fine for a single API instance). If the
// API is ever scaled horizontally, back it with Redis or the database.

const config = require('../config');
const ApiError = require('../utils/ApiError');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.removeHeader('X-Powered-By');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

// Allows only configured browser origins. Requests with no Origin header
// (curl, server-to-server, same-origin) are not affected.
function corsAllowList(req, res, next) {
  const origin = req.headers.origin;
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Access-Source');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    return res.status(origin && config.corsOrigins.includes(origin) ? 204 : 403).end();
  }
  next();
}

const buckets = new Map();

// rateLimit({ windowMs, max, key }) -> middleware. `key(req)` may return a
// string to add to the client IP (e.g. the login email) so one noisy account
// cannot lock out everybody behind the same proxy.
function rateLimit({ windowMs, max, name = 'default', key = () => '' }) {
  return (req, res, next) => {
    if (config.env === 'test' && !process.env.RATE_LIMIT_IN_TESTS) return next();

    const id = `${name}:${req.ip}:${key(req)}`;
    const now = Date.now();
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(id, bucket);
    }
    bucket.count += 1;

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(new ApiError(429, 'Too many requests. Please try again later.'));
    }
    next();
  };
}

// Drop expired buckets so the Map cannot grow without bound.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [id, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(id);
  }
}, 60 * 1000);
sweeper.unref();

module.exports = { securityHeaders, corsAllowList, rateLimit };
