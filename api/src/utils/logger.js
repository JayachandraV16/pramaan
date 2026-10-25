// api/src/utils/logger.js
//
// Minimal, dependency-free logger: timestamp + level + message, one line
// per call. No winston/pino, no external log service — intentionally
// boring per project rule #7 (no over-engineering for a hackathon build).
// Swap it later only if a real, specific need shows up.
//
// Usage: const logger = require('../utils/logger'); logger.info('...')

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function log(level, ...args) {
  if (LEVELS[level] > currentLevel) return;
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

module.exports = {
  error: (...args) => log('error', ...args),
  warn: (...args) => log('warn', ...args),
  info: (...args) => log('info', ...args),
  debug: (...args) => log('debug', ...args),
};
