// api/src/config/roles.js
//
// Single source of truth for role strings. Every module's route guards and
// the RBAC middleware import from here — never hardcode a role string
// anywhere else. Add new roles here only.

// Must match the `role_name` enum in db/migrations/001_create_extensions_and_enums.sql
// and the seeded rows in the `roles` table exactly — these are string
// comparisons against roles.name, not arbitrary labels.
const ROLES = Object.freeze({
  INSTRUMENT_OWNER: 'INSTRUMENT_OWNER',
  LMO: 'LMO', // Legal Metrology Officer — mobile field verification
  GATC: 'GATC',
  ADMIN: 'ADMIN',
});

const ALL_ROLES = Object.values(ROLES);

module.exports = { ROLES, ALL_ROLES };
