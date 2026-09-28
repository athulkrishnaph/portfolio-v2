CREATE TABLE certificates (
    id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title          TEXT        NOT NULL CHECK (btrim(title) <> ''),
    issuer         TEXT        NOT NULL CHECK (btrim(issuer) <> ''),
    issue_date     DATE        NOT NULL,
    credential_url TEXT        NOT NULL DEFAULT '',
    image_url      TEXT        NOT NULL DEFAULT '',
    display_order  INTEGER     NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX certificates_display_order_idx ON certificates (display_order, issue_date DESC);

CREATE TRIGGER certificates_set_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
