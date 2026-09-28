-- The portfolio owner's profile. There is exactly one row, which the
-- CHECK (id = 1) constraint enforces.
-- Optional text columns use NOT NULL DEFAULT '' so "no value" is always ''
-- rather than sometimes NULL and sometimes ''.
CREATE TABLE profile (
    id         SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    full_name  TEXT        NOT NULL CHECK (full_name <> ''),
    headline   TEXT        NOT NULL DEFAULT '',
    bio        TEXT        NOT NULL DEFAULT '',
    email      TEXT        NOT NULL DEFAULT '',
    location   TEXT        NOT NULL DEFAULT '',
    image_url  TEXT        NOT NULL DEFAULT '',
    resume_url TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profile_set_updated_at
    BEFORE UPDATE ON profile
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Social / external links shown on the profile (GitHub, LinkedIn, blog, ...).
CREATE TABLE social_links (
    id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id    SMALLINT    NOT NULL REFERENCES profile (id) ON DELETE CASCADE,
    platform      TEXT        NOT NULL CHECK (platform <> ''),
    url           TEXT        NOT NULL CHECK (url <> ''),
    display_order INTEGER     NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One link per platform; this unique index also serves profile_id lookups.
    UNIQUE (profile_id, platform)
);

CREATE TRIGGER social_links_set_updated_at
    BEFORE UPDATE ON social_links
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
