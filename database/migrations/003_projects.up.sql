CREATE TABLE projects (
    id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title         TEXT        NOT NULL CHECK (btrim(title) <> ''),
    -- URL-friendly identifier, e.g. "task-tracker-api".
    slug          TEXT        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    summary       TEXT        NOT NULL DEFAULT '',   -- short text for cards
    description   TEXT        NOT NULL DEFAULT '',   -- long text for the details page
    github_url    TEXT        NOT NULL DEFAULT '',
    live_url      TEXT        NOT NULL DEFAULT '',
    image_url     TEXT        NOT NULL DEFAULT '',
    is_featured   BOOLEAN     NOT NULL DEFAULT false,
    display_order INTEGER     NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lists are always sorted by display_order.
CREATE INDEX projects_display_order_idx ON projects (display_order, id);
-- Partial index: only featured projects, used by the home page.
CREATE INDEX projects_featured_idx ON projects (display_order) WHERE is_featured;

CREATE TRIGGER projects_set_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Technologies used by a project (one-to-many). Deleting a project deletes
-- its technology rows automatically (ON DELETE CASCADE).
CREATE TABLE project_technologies (
    id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id    BIGINT      NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name          TEXT        NOT NULL CHECK (btrim(name) <> ''),
    display_order INTEGER     NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A technology is listed at most once per project. The index also
    -- serves "all technologies for project X" lookups.
    UNIQUE (project_id, name)
);

CREATE TRIGGER project_technologies_set_updated_at
    BEFORE UPDATE ON project_technologies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
