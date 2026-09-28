CREATE TABLE skills (
    id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          TEXT        NOT NULL CHECK (btrim(name) <> ''),
    -- Free-text grouping shown on the Skills page, e.g. "Frontend", "Backend".
    category      TEXT        NOT NULL CHECK (btrim(category) <> ''),
    display_order INTEGER     NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A skill appears only once, whatever its capitalisation ("Go" = "go").
CREATE UNIQUE INDEX skills_name_lower_key ON skills (lower(name));
-- The Skills page groups by category and then sorts.
CREATE INDEX skills_category_order_idx ON skills (category, display_order);

CREATE TRIGGER skills_set_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
