-- =============================================================================
-- Migration 003: Users
-- =============================================================================
-- Represents ALL stakeholders (Instrument Owner, LMO, GATC user, Admin,
-- Public User) through a single table + role_id FK, per scope rules.
-- =============================================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,

    full_name       TEXT NOT NULL,
    email           CITEXT,
    phone           TEXT,

    -- Security: only the hash is ever stored. Application layer is
    -- responsible for hashing (e.g. bcrypt/argon2) before INSERT/UPDATE.
    password_hash   TEXT NOT NULL,

    -- Free-text organisation/address fields kept minimal per scope rules
    -- (no separate organisation/jurisdiction hierarchy).
    organization_name TEXT,
    address         TEXT,

    status          user_status NOT NULL DEFAULT 'ACTIVE',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL),
    CONSTRAINT ck_users_password_hash_not_blank CHECK (length(trim(password_hash)) > 0)
);

COMMENT ON TABLE users IS 'All platform stakeholders (owners, LMO/GATC staff, admins, public users), distinguished by role_id.';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt/argon2 password hash. Plaintext passwords must never be stored.';

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role_id ON users (role_id);
CREATE INDEX idx_users_status ON users (status);

CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();