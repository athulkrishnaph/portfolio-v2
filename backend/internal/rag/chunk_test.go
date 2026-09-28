package rag

import (
	"strings"
	"testing"
	"unicode/utf8"

	"portfolio/internal/experience"
	"portfolio/internal/profile"
	"portfolio/internal/projects"
	"portfolio/internal/skills"
)

func sampleContent() Content {
	end := "2023-02-28"
	return Content{
		Profile: &profile.Profile{
			FullName: "Ada Lovelace", Headline: "Backend Developer", Bio: "First paragraph.\n\nSecond paragraph.",
			Email: "ada@example.com", Location: "London",
			SocialLinks: []profile.SocialLink{{Platform: "GitHub", URL: "https://github.com/ada"}},
		},
		Projects: []projects.Project{{
			ID: 7, Title: "Engine", Slug: "engine", Summary: "An analytical engine.",
			Technologies: []string{"Go", "PostgreSQL"}, GitHubURL: "https://github.com/ada/engine", IsFeatured: true,
		}},
		Experience: []experience.Experience{
			{ID: 1, Company: "Babbage & Co", Position: "Engineer", StartDate: "2020-01-01", EndDate: &end},
			{ID: 2, Company: "Now Ltd", Position: "Lead", StartDate: "2023-03-01", IsCurrent: true},
		},
		Skills: []skills.Skill{
			{Name: "Go", Category: "Backend"}, {Name: "Angular", Category: "Frontend"}, {Name: "SQL", Category: "Backend"},
		},
		ResumeText: "# Ada Lovelace\nMathematician.\n\n## Experience\n- Babbage & Co\n\n## Skills\nGo, SQL",
		Markdown:   []MarkdownFile{{Name: "achievements", Text: "## Awards\nFirst programmer."}},
	}
}

func byKey(chunks []Chunk) map[string]Chunk {
	m := map[string]Chunk{}
	for _, c := range chunks {
		m[c.Key] = c
	}
	return m
}

func TestBuildChunks(t *testing.T) {
	chunks := BuildChunks(sampleContent())
	got := byKey(chunks)

	check := func(key, source, url string, contains ...string) {
		t.Helper()
		c, ok := got[key]
		if !ok {
			t.Fatalf("missing chunk %q (have %d chunks)", key, len(chunks))
		}
		if c.Source != source || c.URL != url {
			t.Errorf("%s: source=%q url=%q, want %q %q", key, c.Source, c.URL, source, url)
		}
		for _, s := range contains {
			if !strings.Contains(c.Content, s) {
				t.Errorf("%s: content %q does not contain %q", key, c.Content, s)
			}
		}
	}

	check("profile:about:1", "profile", "/about", "Ada Lovelace", "Backend Developer", "First paragraph.")
	check("profile:contact", "contact", "/contact", "ada@example.com", "GitHub: https://github.com/ada")
	check("projects:7:1", "projects", "/projects/engine", "Engine", "Technologies used: Go, PostgreSQL", "Featured project")
	check("experience:1", "experience", "/experience", "Engineer at Babbage & Co", "2020-01-01 to 2023-02-28")
	check("experience:2", "experience", "/experience", "present (current job)")
	check("skills:overview", "skills", "/skills", "Backend: Go, SQL", "Frontend: Angular")
	check("skills:backend", "skills", "/skills", "Go, SQL")
	check("knowledge:achievements:1", "knowledge", "", "First programmer.")

	// The resume is split at its headings, and each chunk keeps its section.
	var resumeSections []string
	for _, c := range chunks {
		if c.Source == "resume" {
			resumeSections = append(resumeSections, c.Section)
		}
	}
	if strings.Join(resumeSections, "|") != "Ada Lovelace|Experience|Skills" {
		t.Errorf("resume sections = %v", resumeSections)
	}
}

func TestBuildChunksIsDeterministicAndKeysAreUnique(t *testing.T) {
	a, b := BuildChunks(sampleContent()), BuildChunks(sampleContent())
	if len(a) != len(b) {
		t.Fatal("different chunk counts for the same content")
	}
	seen := map[string]bool{}
	for i := range a {
		if a[i] != b[i] {
			t.Errorf("chunk %d differs between runs", i)
		}
		if seen[a[i].Key] {
			t.Errorf("duplicate key %q", a[i].Key)
		}
		seen[a[i].Key] = true
	}
}

func TestBuildChunksWithoutProfile(t *testing.T) {
	chunks := BuildChunks(Content{Skills: []skills.Skill{{Name: "Go", Category: "Backend"}}})
	if len(chunks) != 2 || !strings.Contains(chunks[0].Content, "the portfolio owner") {
		t.Errorf("chunks = %+v", chunks)
	}
}

func TestLongProjectDescriptionIsSplitBetweenParagraphs(t *testing.T) {
	para := strings.Repeat("word ", 200) // ~1000 characters
	p := projects.Project{ID: 1, Title: "Big", Slug: "big", Description: para + "\n\n" + para + "\n\n" + para}
	chunks := projectChunks(p, "Ada")
	if len(chunks) < 2 {
		t.Fatalf("expected the description to be split, got %d chunk(s)", len(chunks))
	}
	for _, c := range chunks {
		// Every part repeats the project header so it stands on its own.
		if !strings.Contains(c.Content, "Project by Ada: Big") {
			t.Errorf("chunk %s lacks the project header", c.Key)
		}
	}
}

func TestPackParagraphs(t *testing.T) {
	if got := packParagraphs("  ", 100); got != nil {
		t.Errorf("blank text: got %v", got)
	}
	got := packParagraphs("one\n\ntwo\n\nthree", 9)
	if strings.Join(got, "|") != "one\n\ntwo|three" {
		t.Errorf("got %q", got)
	}
	// A single huge paragraph without sentence breaks is still bounded.
	for _, part := range packParagraphs(strings.Repeat("x", 3500), 1500) {
		if utf8.RuneCountInString(part) > 1500 {
			t.Errorf("part has %d characters", utf8.RuneCountInString(part))
		}
	}
	// Long paragraphs are split at sentence ends.
	sentences := strings.Repeat("This is a sentence. ", 100)
	for _, part := range packParagraphs(sentences, 300) {
		if !strings.HasSuffix(strings.TrimSpace(part), ".") {
			t.Errorf("part does not end at a sentence: %q", part[len(part)-20:])
		}
	}
}

func TestSplitMarkdownSections(t *testing.T) {
	got := splitMarkdownSections("intro\n# One\nfirst\n\n## Two ##\nsecond\n### Empty\n")
	if len(got) != 3 || got[0].heading != "" || got[1].heading != "One" || got[2].heading != "Two" {
		t.Fatalf("sections = %+v", got)
	}
	if got[2].body != "second" {
		t.Errorf("body = %q", got[2].body)
	}
}
