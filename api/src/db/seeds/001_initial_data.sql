-- =============================================================================
-- Seed 001: Initial Development Data
-- =============================================================================
-- Minimal seed data for local development. Safe to run repeatedly
-- (idempotent via ON CONFLICT DO NOTHING).
--
-- SECURITY NOTE: The development users below are for LOCAL DEVELOPMENT ONLY.
-- Their password_hash values are bcrypt hashes of the literal string
-- 'DevPassword123!' (cost factor 10) — clearly not for production use.
-- Never seed real production accounts through this file.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
    ('INSTRUMENT_OWNER', 'Owner of one or more weighing/measuring instruments who applies for verification.'),
    ('LMO',              'Legal Metrology Officer who performs/oversees field verification.'),
    ('GATC',             'Government Approved Test Centre user who performs field verification.'),
    ('ADMIN',            'Platform administrator with full oversight of the verification workflow.'),
    ('PUBLIC_USER',      'Public/unauthenticated-tier user who can look up and authenticate certificates.')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Instrument Types
-- ---------------------------------------------------------------------------
INSERT INTO instrument_types (name, description, default_unit) VALUES
    ('Weighing Scale',        'General-purpose mechanical or electronic weighing scale.', 'kg'),
    ('Electronic Balance',    'Precision electronic balance used for small-mass measurement.', 'g'),
    ('Platform Scale',        'Heavy-duty platform scale for industrial/commercial weighing.', 'kg'),
    ('Weighbridge',           'Large-capacity vehicle weighbridge.', 'kg'),
    ('Fuel Dispensing Unit',  'Petrol/diesel dispensing pump measuring instrument.', 'litre'),
    ('Measuring Instrument',  'General liquid/length/volume measuring instrument.', 'litre')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Development-only users
-- password_hash below = bcrypt('DevPassword123!'), cost 10.
-- DO NOT use these accounts or hash in production.
-- ---------------------------------------------------------------------------
INSERT INTO users (role_id, full_name, email, phone, password_hash, organization_name, status)
SELECT r.id, 'Dev Admin', 'dev.admin@pramaan.local', '9000000001',
       '$2b$10$CwTycUXWue0Thq9StjUM0uJ8pFGVXK1z8Ht4Xc3g6vqhz9O1qJZTa',
       'Legal Metrology Department (Dev)', 'ACTIVE'
FROM roles r WHERE r.name = 'ADMIN'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (role_id, full_name, email, phone, password_hash, organization_name, status)
SELECT r.id, 'Dev Instrument Owner', 'dev.owner@pramaan.local', '9000000002',
       '$2b$10$CwTycUXWue0Thq9StjUM0uJ8pFGVXK1z8Ht4Xc3g6vqhz9O1qJZTa',
       'Sharma General Store', 'ACTIVE'
FROM roles r WHERE r.name = 'INSTRUMENT_OWNER'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (role_id, full_name, email, phone, password_hash, organization_name, status)
SELECT r.id, 'Dev LMO Officer', 'dev.lmo@pramaan.local', '9000000003',
       '$2b$10$CwTycUXWue0Thq9StjUM0uJ8pFGVXK1z8Ht4Xc3g6vqhz9O1qJZTa',
       'District Legal Metrology Office (Dev)', 'ACTIVE'
FROM roles r WHERE r.name = 'LMO'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (role_id, full_name, email, phone, password_hash, organization_name, status)
SELECT r.id, 'Dev GATC User', 'dev.gatc@pramaan.local', '9000000004',
       '$2b$10$CwTycUXWue0Thq9StjUM0uJ8pFGVXK1z8Ht4Xc3g6vqhz9O1qJZTa',
       'Government Approved Test Centre (Dev)', 'ACTIVE'
FROM roles r WHERE r.name = 'GATC'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (role_id, full_name, email, phone, password_hash, status)
SELECT r.id, 'Dev Public User', 'dev.public@pramaan.local', '9000000005',
       '$2b$10$CwTycUXWue0Thq9StjUM0uJ8pFGVXK1z8Ht4Xc3g6vqhz9O1qJZTa',
       'ACTIVE'
FROM roles r WHERE r.name = 'PUBLIC_USER'
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- One sample instrument owned by the dev owner (useful for manual API testing)
-- ---------------------------------------------------------------------------
INSERT INTO instruments (
    owner_id, instrument_type_id, instrument_name, manufacturer, model,
    serial_number, capacity, capacity_unit, accuracy_class, location_address, status
)
SELECT u.id, it.id, 'Shop Counter Scale', 'Avery Weigh-Tronix', 'AWT-200',
       'SN-DEV-0001', 200.000, 'kg', 'Class III', 'Shop No. 12, MG Road, Pune', 'ACTIVE'
FROM users u, instrument_types it
WHERE u.email = 'dev.owner@pramaan.local' AND it.name = 'Weighing Scale'
ON CONFLICT (serial_number) DO NOTHING;