CREATE TABLE education (
    id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    institution    TEXT        NOT NULL CHECK (btrim(institution) <> ''),
    degree         TEXT        NOT NULL CHECK (btrim(degree) <> ''),
    field_of_study TEXT        NOT NULL DEFAULT '',
    location       TEXT        NOT NULL DEFAULT '',
    description    TEXT        NOT NULL DEFAULT '',
    start_date     DATE        NOT NULL,
    end_date       DATE,                              -- NULL while still studying
    display_order  INTEGER     NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT education_dates_ordered CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX education_display_order_idx ON education (display_order, start_date DESC);

CREATE TRIGGER education_set_updated_at
    BEFORE UPDATE ON education
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
