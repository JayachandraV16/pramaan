// api/src/utils/delivery.js
//
// E-mail and SMS delivery of notifications (outbox pattern).
//
//   enqueueDeliveries(client, notification)   called by notify(), inside the same
//                                             transaction as the notification itself
//   deliverDue({ limit })                     called by the background job; sends due
//                                             rows with retries and exponential backoff
//
// DELIVERY_MODE: off (default: nothing is queued) | log (queued and "sent" to
// the log only - for development) | live (real SMTP / SMS gateway).
// E-mail goes out for every notification; SMS only for the types in SMS_TYPES
// (costly and DLT-regulated in India). Users can switch each channel off.

const config = require('../config');
const pool = require('../pool');
const logger = require('./logger');

const SMS_TYPES = new Set([
  'CERTIFICATE_ISSUED', 'CERTIFICATE_EXPIRING', 'CERTIFICATE_EXPIRED', 'CERTIFICATE_REVOKED',
  'VERIFICATION_SCHEDULED', 'ENFORCEMENT_ACTION',
]);
const MAX_ATTEMPTS = 5;
const UNDELIVERABLE_DOMAIN = /(\.(local|test|invalid|localhost|example)|@example\.(com|org|net))$/i;

function normaliseEmail(email) {
  if (typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || UNDELIVERABLE_DOMAIN.test(e)) return null;
  return e;
}

// Returns E.164 (+91XXXXXXXXXX for Indian mobiles) or null.
function normalisePhone(phone) {
  if (typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits[2])) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits[1])) return `+91${digits.slice(1)}`;
  return null;
}

async function enqueueDeliveries(client, { id, recipientId, type }) {
  if (config.delivery.mode === 'off' || !id) return;
  const { rows } = await client.query(
    "SELECT email, phone, notify_email, notify_sms FROM users WHERE id = $1 AND status = 'ACTIVE'",
    [recipientId]
  );
  const user = rows[0];
  if (!user) return;

  const email = user.notify_email ? normaliseEmail(user.email) : null;
  const phone = user.notify_sms && SMS_TYPES.has(type) ? normalisePhone(user.phone) : null;
  for (const [channel, destination] of [['EMAIL', email], ['SMS', phone]]) {
    if (!destination) continue;
    await client.query(
      `INSERT INTO notification_deliveries (notification_id, channel, destination)
       VALUES ($1, $2, $3) ON CONFLICT (notification_id, channel) DO NOTHING`,
      [id, channel, destination]
    );
  }
}

// ---- providers --------------------------------------------------------------

let overrides = null; // tests inject fakes: setProviders({ email: { send }, sms: { send } })
function setProviders(p) {
  overrides = p;
}

let emailTransport = null;
function emailProvider() {
  if (overrides && overrides.email) return overrides.email;
  const { mode, smtpUrl, emailFrom } = config.delivery;
  if (mode === 'log') {
    return { send: async ({ to, subject }) => { logger.info(`[delivery:log] e-mail to ${to}: ${subject}`); return { ref: 'log' }; } };
  }
  if (!smtpUrl) return null;
  if (!emailTransport) emailTransport = require('nodemailer').createTransport(smtpUrl);
  return {
    send: async ({ to, subject, text }) => {
      const info = await emailTransport.sendMail({ from: emailFrom, to, subject, text });
      return { ref: info.messageId };
    },
  };
}

function smsProvider() {
  if (overrides && overrides.sms) return overrides.sms;
  const { mode, smsUrl, smsToken, smsSender } = config.delivery;
  if (mode === 'log') {
    return { send: async ({ to }) => { logger.info(`[delivery:log] SMS to ${to}`); return { ref: 'log' }; } };
  }
  if (!smsUrl) return null;
  return {
    // Generic JSON gateway: POST { to, message, sender } with a bearer token.
    // Adapt the body here for a specific provider (MSG91, Twilio, ...).
    send: async ({ to, text }) => {
      const res = await fetch(smsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(smsToken ? { Authorization: `Bearer ${smsToken}` } : {}) },
        body: JSON.stringify({ to, message: text, sender: smsSender }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const err = new Error(`SMS gateway answered ${res.status}`);
        err.permanent = res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408;
        throw err;
      }
      let ref = null;
      try { ref = (await res.json()).id || null; } catch { /* gateway returned no JSON */ }
      return { ref };
    },
  };
}

// ---- message building --------------------------------------------------------

const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();

function buildEmail(row) {
  return {
    to: row.destination,
    subject: `[Pramaan] ${oneLine(row.title)}`.slice(0, 200),
    text: `${row.message}\n\n— Pramaan\n${config.frontendUrl}/notifications\n`,
  };
}

function buildSms(row) {
  return { to: row.destination, text: `Pramaan: ${oneLine(row.title)}. ${oneLine(row.message)}`.slice(0, 320) };
}

const backoffMinutes = (attempts) => Math.min(2 ** attempts, 240);

// ---- worker ------------------------------------------------------------------

async function deliverDue({ limit = 50 } = {}) {
  const summary = { sent: 0, failed: 0, retried: 0, skipped: 0 };
  if (config.delivery.mode === 'off') return summary;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT d.id, d.channel, d.destination, d.attempts, n.title, n.message
         FROM notification_deliveries d
         JOIN notifications n ON n.id = d.notification_id
        WHERE d.status = 'PENDING' AND d.next_attempt_at <= now()
        ORDER BY d.next_attempt_at
        LIMIT $1
        FOR UPDATE OF d SKIP LOCKED`,
      [limit]
    );

    for (const row of rows) {
      const provider = row.channel === 'EMAIL' ? emailProvider() : smsProvider();
      if (!provider) {
        await client.query(
          "UPDATE notification_deliveries SET status = 'SKIPPED', last_error = $2 WHERE id = $1",
          [row.id, `No ${row.channel.toLowerCase()} provider configured`]
        );
        summary.skipped += 1;
        continue;
      }
      try {
        const { ref } = await provider.send(row.channel === 'EMAIL' ? buildEmail(row) : buildSms(row));
        await client.query(
          "UPDATE notification_deliveries SET status = 'SENT', sent_at = now(), attempts = attempts + 1, provider_ref = $2, last_error = NULL WHERE id = $1",
          [row.id, ref || null]
        );
        summary.sent += 1;
      } catch (err) {
        const attempts = row.attempts + 1;
        const giveUp = err.permanent || attempts >= MAX_ATTEMPTS;
        await client.query(
          `UPDATE notification_deliveries
              SET status = $2, attempts = $3, last_error = $4,
                  next_attempt_at = now() + ($5 || ' minutes')::interval
            WHERE id = $1`,
          [row.id, giveUp ? 'FAILED' : 'PENDING', attempts, String(err.message).slice(0, 500), String(backoffMinutes(attempts))]
        );
        if (giveUp) summary.failed += 1;
        else summary.retried += 1;
        logger.warn(`Delivery ${row.id} (${row.channel}) ${giveUp ? 'failed' : 'will retry'}: ${err.message}`);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return summary;
}

module.exports = { enqueueDeliveries, deliverDue, setProviders, normaliseEmail, normalisePhone, buildEmail, buildSms, SMS_TYPES, MAX_ATTEMPTS };
