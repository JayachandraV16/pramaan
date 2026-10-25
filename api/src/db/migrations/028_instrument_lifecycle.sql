-- 028_instrument_lifecycle.sql
-- Instrument edit / deactivate / decommission.
--   INACTIVE       temporarily out of use (reversible)
--   DECOMMISSIONED permanently withdrawn (final; the row is frozen)
-- The reason and who/when are kept on the row; every change is also in the audit log.

ALTER TABLE instruments
    ADD COLUMN status_reason       TEXT,
    ADD COLUMN status_changed_at   TIMESTAMPTZ,
    ADD COLUMN status_changed_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE instruments
    ADD CONSTRAINT ck_instruments_decommission_reason
    CHECK (status <> 'DECOMMISSIONED' OR status_reason IS NOT NULL) NOT VALID;

CREATE OR REPLACE FUNCTION protect_instrument_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'DECOMMISSIONED' THEN
        RAISE EXCEPTION 'Instrument % is decommissioned and cannot be changed', OLD.serial_number;
    END IF;

    -- A certificate and its applications refer to the serial number and type, so they
    -- are fixed as soon as the instrument has been the subject of an application.
    IF (NEW.serial_number IS DISTINCT FROM OLD.serial_number
        OR NEW.instrument_type_id IS DISTINCT FROM OLD.instrument_type_id)
       AND EXISTS (SELECT 1 FROM verification_applications WHERE instrument_id = OLD.id) THEN
        RAISE EXCEPTION 'Serial number and type of instrument % are fixed once an application exists', OLD.serial_number;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_instruments_lifecycle
    BEFORE UPDATE ON instruments
    FOR EACH ROW
    EXECUTE FUNCTION protect_instrument_lifecycle();
