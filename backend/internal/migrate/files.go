// Package migrate applies and rolls back plain-SQL schema migrations and
// loads seed data.
//
// Migration files live in one directory and are named
//
//	<version>_<name>.up.sql     applied by "up"
//	<version>_<name>.down.sql   applied by "down" to undo the matching up file
//
// for example 003_projects.up.sql. Versions are positive integers and are
// applied in ascending order. Applied versions are recorded in the
// schema_migrations table so each migration runs exactly once.
package migrate

import (
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strconv"
)

// Migration is one versioned schema change (an up file plus its down file).
type Migration struct {
	Version  int64
	Name     string
	UpFile   string
	DownFile string
}

// fileNamePattern captures version, name and direction from a file name.
var fileNamePattern = regexp.MustCompile(`^(\d+)_([a-z0-9_]+)\.(up|down)\.sql$`)

// Load reads the migration files in fsys (a directory), checks that every
// version has both an up and a down file, and returns them sorted by version.
func Load(fsys fs.FS) ([]Migration, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, fmt.Errorf("read migrations dir: %w", err)
	}

	byVersion := map[int64]*Migration{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		m := fileNamePattern.FindStringSubmatch(entry.Name())
		if m == nil {
			return nil, fmt.Errorf("invalid migration file name %q (expected NNN_name.up.sql or NNN_name.down.sql)", entry.Name())
		}

		version, err := strconv.ParseInt(m[1], 10, 64)
		if err != nil || version <= 0 {
			return nil, fmt.Errorf("invalid version in %q", entry.Name())
		}
		name, direction := m[2], m[3]

		mig, ok := byVersion[version]
		if !ok {
			mig = &Migration{Version: version, Name: name}
			byVersion[version] = mig
		}
		if mig.Name != name {
			return nil, fmt.Errorf("version %d is used by two different migrations: %q and %q", version, mig.Name, name)
		}

		if direction == "up" {
			mig.UpFile = entry.Name()
		} else {
			mig.DownFile = entry.Name()
		}
	}

	migrations := make([]Migration, 0, len(byVersion))
	for _, mig := range byVersion {
		if mig.UpFile == "" || mig.DownFile == "" {
			return nil, fmt.Errorf("migration %03d_%s must have both .up.sql and .down.sql files", mig.Version, mig.Name)
		}
		migrations = append(migrations, *mig)
	}
	sort.Slice(migrations, func(i, j int) bool { return migrations[i].Version < migrations[j].Version })
	return migrations, nil
}
