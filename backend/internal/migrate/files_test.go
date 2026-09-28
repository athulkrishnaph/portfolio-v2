package migrate

import (
	"strings"
	"testing"
	"testing/fstest"
)

func TestLoadSortsAndPairsFiles(t *testing.T) {
	fsys := fstest.MapFS{
		"002_projects.up.sql":   {Data: []byte("-- up")},
		"002_projects.down.sql": {Data: []byte("-- down")},
		"001_users.up.sql":      {Data: []byte("-- up")},
		"001_users.down.sql":    {Data: []byte("-- down")},
	}

	got, err := Load(fsys)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 migrations, got %d", len(got))
	}
	if got[0].Version != 1 || got[1].Version != 2 {
		t.Errorf("migrations not sorted by version: %+v", got)
	}
	if got[0].UpFile != "001_users.up.sql" || got[0].DownFile != "001_users.down.sql" {
		t.Errorf("files not paired correctly: %+v", got[0])
	}
}

func TestLoadRejectsInvalidSets(t *testing.T) {
	tests := []struct {
		name    string
		files   []string
		wantErr string
	}{
		{"missing down file", []string{"001_users.up.sql"}, "must have both"},
		{"bad file name", []string{"users.sql"}, "invalid migration file name"},
		{"uppercase name", []string{"001_Users.up.sql"}, "invalid migration file name"},
		{"duplicate version", []string{
			"001_users.up.sql", "001_users.down.sql",
			"001_other.up.sql", "001_other.down.sql",
		}, "used by two different migrations"},
		{"zero version", []string{"000_x.up.sql", "000_x.down.sql"}, "invalid version"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fsys := fstest.MapFS{}
			for _, f := range tt.files {
				fsys[f] = &fstest.MapFile{Data: []byte("--")}
			}
			_, err := Load(fsys)
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("expected error containing %q, got %v", tt.wantErr, err)
			}
		})
	}
}
