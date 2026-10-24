// api/src/jobs/index.js
//
// The daily maintenance run: expire lapsed certificates, then send expiry
// reminders. Safe to run repeatedly. Triggered by the in-process scheduler
// (src/jobs/scheduler.js), by `npm run jobs:run`, or by an external cron.

const { expireDueCertificates } = require('./certificateLifecycle');
const { sendExpiryReminders } = require('./expiryReminders');

async function runDailyJobs() {
  const expired = await expireDueCertificates();
  const reminders = await sendExpiryReminders();
  return { expired: expired.expired, reminders };
}

module.exports = { runDailyJobs };
