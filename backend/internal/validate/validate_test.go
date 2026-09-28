package validate

import (
	"errors"
	"testing"
)

func TestValidatorKeepsFirstErrorPerField(t *testing.T) {
	v := New()
	v.Check(true, "title", "never recorded")
	v.Check(false, "title", "Title is required")
	v.Check(false, "title", "Title is too long")
	v.Check(false, "email", "Email is invalid")

	var verr *Error
	if !errors.As(v.Err(), &verr) {
		t.Fatalf("Err() = %v, want *Error", v.Err())
	}
	if len(verr.Fields) != 2 || verr.Fields["title"] != "Title is required" {
		t.Errorf("fields = %v", verr.Fields)
	}
}

func TestValidatorNoErrors(t *testing.T) {
	v := New()
	v.Check(true, "title", "unused")
	if err := v.Err(); err != nil {
		t.Errorf("Err() = %v, want nil", err)
	}
}

func TestHelpers(t *testing.T) {
	checks := []struct {
		name string
		got  bool
		want bool
	}{
		{"NotBlank text", NotBlank(" a "), true},
		{"NotBlank spaces", NotBlank(" \t\n"), false},
		{"MaxLen counts runes", MaxLen("héllo", 5), true},
		{"MaxLen too long", MaxLen("hello!", 5), false},
		{"IsURL https", IsURL("https://github.com/me"), true},
		{"IsURL http", IsURL("http://localhost:4200"), true},
		{"IsURL no scheme", IsURL("github.com/me"), false},
		{"IsURL javascript", IsURL("javascript:alert(1)"), false},
		{"IsEmail plain", IsEmail("me@example.com"), true},
		{"IsEmail display name", IsEmail("Me <me@example.com>"), false},
		{"IsEmail missing @", IsEmail("me.example.com"), false},
	}
	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, c.got, c.want)
		}
	}
}
