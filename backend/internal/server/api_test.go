package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"portfolio/internal/auth"
	"portfolio/internal/config"
	"portfolio/internal/storage"
	"portfolio/internal/testdb"
)

// TestAPI exercises the real HTTP stack (router, middleware, handlers,
// services, repositories) against a real, isolated database.
func TestAPI(t *testing.T) {
	db := testdb.New(t)
	cfg := &config.Config{JWTSecret: strings.Repeat("s", 32), JWTTTL: time.Hour}
	files, err := storage.NewLocal(t.TempDir(), "http://test")
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(New(Deps{Config: cfg, DB: db, Storage: files}))
	defer srv.Close()

	// Create an admin directly through the service, like cmd/createadmin does.
	authSvc := auth.NewService(auth.NewRepository(db), auth.NewTokenManager(cfg.JWTSecret, cfg.JWTTTL))
	if _, err := authSvc.CreateAdmin(context.Background(), "admin@test.dev", "a-long-password"); err != nil {
		t.Fatal(err)
	}

	call := func(method, path, token, body string) (int, map[string]any) {
		t.Helper()
		req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		raw, _ := io.ReadAll(res.Body)
		var parsed map[string]any
		_ = json.Unmarshal(raw, &parsed)
		return res.StatusCode, parsed
	}

	// Login.
	status, body := call("POST", "/api/auth/login", "", `{"email":"admin@test.dev","password":"a-long-password"}`)
	if status != http.StatusOK {
		t.Fatalf("login: %d %v", status, body)
	}
	token := body["data"].(map[string]any)["token"].(string)

	// Writes require authentication.
	if status, _ := call("POST", "/api/skills", "", `{"name":"Go","category":"Backend"}`); status != http.StatusUnauthorized {
		t.Errorf("anonymous create: %d, want 401", status)
	}

	// Create → read → validation → delete.
	status, body = call("POST", "/api/skills", token, `{"name":"Go","category":"Backend","displayOrder":1,"isFeatured":true}`)
	if status != http.StatusCreated {
		t.Fatalf("create: %d %v", status, body)
	}
	id := body["data"].(map[string]any)["id"].(float64)

	if status, body = call("GET", "/api/skills", "", ""); status != 200 || len(body["data"].([]any)) != 1 {
		t.Errorf("public list: %d %v", status, body)
	} else if featured := body["data"].([]any)[0].(map[string]any)["isFeatured"]; featured != true {
		t.Errorf("isFeatured = %v, want true", featured)
	}

	status, body = call("POST", "/api/skills", token, `{"name":"go","category":"Backend"}`)
	if status != http.StatusUnprocessableEntity || !strings.Contains(toJSON(body), "already exists") {
		t.Errorf("duplicate: %d %v", status, body)
	}

	if status, _ = call("DELETE", "/api/skills/"+jsonNumber(id), token, ""); status != http.StatusNoContent {
		t.Errorf("delete: %d", status)
	}

	// Profile does not exist until saved, then round-trips with its links.
	if status, _ = call("GET", "/api/profile", "", ""); status != http.StatusNotFound {
		t.Errorf("empty profile: %d, want 404", status)
	}
	status, body = call("PUT", "/api/profile", token,
		`{"fullName":"Test User","socialLinks":[{"platform":"GitHub","url":"https://github.com/t"}]}`)
	if status != http.StatusOK || !strings.Contains(toJSON(body), `"platform":"GitHub"`) {
		t.Errorf("save profile: %d %v", status, body)
	}
}

func toJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func jsonNumber(f float64) string {
	b, _ := json.Marshal(int64(f))
	return string(b)
}
