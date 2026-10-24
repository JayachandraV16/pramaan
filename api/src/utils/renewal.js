// api/src/utils/renewal.js
//
// One place for "can this instrument be (re-)verified now, and as what?".
// Used when an application is filed and by GET /api/instruments/:id/renewal, so
// the form's guidance and the server's decision can never disagree.
//
//   no certificate yet                      -> initial VERIFICATION
//   valid certificate, > window days left   -> not yet (renewal opens N days before expiry)
//   valid certificate, within the window    -> RE_VERIFICATION (renewal)
//   expired or revoked certificate          -> RE_VERIFICATION
//   instrument inactive/decommissioned, or an application already open -> cannot apply

const DAY_MS = 24 * 60 * 60 * 1000;
const asUtcDay = (ymd) => Date.parse(`${String(ymd).slice(0, 10)}T00:00:00Z`);

function addDays(ymd, days) {
  return new Date(asUtcDay(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

function evaluate({ instrument, latest, open, today, windowDays }) {
  const base = { instrumentStatus: instrument.status, windowDays, latestCertificate: null, daysUntilExpiry: null, opensOn: null };

  if (latest) {
    const stillValid = latest.status === 'ACTIVE' && String(latest.valid_until).slice(0, 10) >= today;
    base.latestCertificate = {
      id: latest.id,
      number: latest.certificate_number,
      status: latest.status,
      validUntil: String(latest.valid_until).slice(0, 10),
      valid: stillValid,
    };
    base.daysUntilExpiry = Math.round((asUtcDay(latest.valid_until) - asUtcDay(today)) / DAY_MS);
  }

  if (instrument.status === 'DECOMMISSIONED') {
    return { ...base, canApply: false, suggestedType: null, code: 'DECOMMISSIONED', reason: 'This instrument has been decommissioned and cannot be verified.' };
  }
  if (instrument.status === 'INACTIVE') {
    return { ...base, canApply: false, suggestedType: null, code: 'INACTIVE', reason: 'This instrument is marked inactive; reactivate it before applying.' };
  }
  if (open) {
    return { ...base, canApply: false, suggestedType: null, code: 'OPEN_APPLICATION', reason: `This instrument already has an open application (${open.application_number}, ${open.status}).` };
  }
  if (!latest) {
    return { ...base, canApply: true, suggestedType: 'VERIFICATION', code: 'FIRST_VERIFICATION', reason: 'No certificate yet: apply for the first verification.' };
  }

  const valid = base.latestCertificate.valid;
  if (valid && base.daysUntilExpiry > windowDays) {
    const opensOn = addDays(base.latestCertificate.validUntil, -windowDays);
    return {
      ...base, opensOn, canApply: false, suggestedType: null, code: 'NOT_DUE',
      reason: `Certificate ${latest.certificate_number} is valid until ${base.latestCertificate.validUntil}. Renewal opens on ${opensOn} (${windowDays} days before expiry).`,
    };
  }
  return {
    ...base, canApply: true, suggestedType: 'RE_VERIFICATION', code: valid ? 'RENEWAL_WINDOW' : 'LAPSED',
    reason: valid
      ? `Certificate ${latest.certificate_number} expires on ${base.latestCertificate.validUntil}: apply for re-verification.`
      : `Certificate ${latest.certificate_number} is ${latest.status === 'REVOKED' ? 'revoked' : 'expired'}: apply for re-verification.`,
  };
}

// Returns an error description for a requested application type, or null when it is acceptable.
function checkRequestedType(result, requestedType) {
  if (!result.canApply) return { status: 409, message: result.reason };
  if (requestedType === result.suggestedType) return null;
  return result.suggestedType === 'RE_VERIFICATION'
    ? { status: 400, message: `This instrument already has certificate ${result.latestCertificate.number}; file a re-verification (renewal), not an initial verification.` }
    : { status: 400, message: 'This instrument has no previous certificate; file an initial verification, not a re-verification.' };
}

module.exports = { evaluate, checkRequestedType };
