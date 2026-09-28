CREATE TABLE experience (
    id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company       TEXT        NOT NULL CHECK (btrim(company) <> ''),
    position      TEXT        NOT NULL CHECK (btrim(position) <> ''),
    location      TEXT        NOT NULL DEFAULT '',
    description   TEXT        NOT NULL DEFAULT '',
    start_date    DATE        NOT NULL,
    end_date      DATE,                               -- NULL while the job is current
    is_current    BOOLEAN     NOT NULL DEFAULT false,
    display_order INTEGER     NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A current job has no end date, and a finished job must have one.
    CONSTRAINT experience_current_has_no_end CHECK (is_current = (end_date IS NULL)),
    CONSTRAINT experience_dates_ordered      CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX experience_display_order_idx ON experience (display_order, start_date DESC);

CREATE TRIGGER experience_set_updated_at
    BEFORE UPDATE ON experience
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
