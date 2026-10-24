// api/src/jobs/scheduler.js
//
// In-process scheduler: runs the daily jobs shortly after boot and then every
// JOBS_INTERVAL_MINUTES (default 360 = 6 h; 0 disables it). Because the jobs
// are idempotent, a short interval is harmless. A PostgreSQL advisory lock
// makes sure only one API instance runs them at a time.

const pool = require('../pool');
const logger = require('../utils/logger');
const { runDailyJobs } = require('./index');

const LOCK_KEY = 727002;

async function runOnceWithLock() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY]);
    if (!rows[0].locked) {
      logger.debug('Daily jobs already running on another instance; skipping');
      return null;
    }
    try {
      const summary = await runDailyJobs();
      logger.info('Daily jobs finished', JSON.stringify(summary));
      return summary;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

function startScheduler({ intervalMinutes, initialDelaySeconds = 30 } = {}) {
  const configured = parseInt(process.env.JOBS_INTERVAL_MINUTES, 10);
  const minutes = intervalMinutes ?? (Number.isNaN(configured) ? 360 : configured);
  if (minutes <= 0) {
    logger.info('Background jobs disabled (JOBS_INTERVAL_MINUTES=0)');
    return null;
  }

  const tick = () =>
    runOnceWithLock().catch((err) => logger.error('Daily jobs failed:', err.message));

  const first = setTimeout(tick, initialDelaySeconds * 1000);
  const timer = setInterval(tick, minutes * 60 * 1000);
  first.unref();
  timer.unref();
  logger.info(`Background jobs scheduled every ${minutes} min`);
  return { stop: () => { clearTimeout(first); clearInterval(timer); } };
}

module.exports = { startScheduler, runOnceWithLock };
