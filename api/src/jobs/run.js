// api/src/jobs/run.js
//
// One-off run of the daily jobs: `npm run jobs:run`. Use this from cron /
// Windows Task Scheduler if you prefer an external trigger over the in-process
// scheduler (set JOBS_INTERVAL_MINUTES=0 in that case).

require('dotenv').config();
const pool = require('../pool');
const logger = require('../utils/logger');
const { runDailyJobs } = require('./index');

runDailyJobs()
  .then((summary) => {
    logger.info('Daily jobs finished', JSON.stringify(summary));
    return pool.end();
  })
  .catch((err) => {
    logger.error('Daily jobs failed:', err.message);
    pool.end().finally(() => process.exit(1));
  });
