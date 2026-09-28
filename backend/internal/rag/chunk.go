// Package rag builds and searches the chatbot's knowledge base
// (retrieval-augmented generation).
//
//	portfolio tables + resume PDF + optional Markdown
//	        │  BuildChunks (this file): one chunk per project, job, …
//	        ▼
//	Indexer: embed changed chunks → knowledge_chunks (pgvector)
//	        ▼
//	Store.Search: question embedding → most similar chunks
package rag

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"portfolio/internal/certificates"
	"portfolio/internal/education"
	"portfolio/internal/experience"
	"portfolio/internal/profile"
	"portfolio/internal/projects"
	"portfolio/internal/skills"
)

// Chunk is one retrievable piece of portfolio knowledge. Title, Section and
// URL are returned to the visitor as the answer's sources.
type Chunk struct {
	Key     string // stable identity, e.g. "projects:3:1"
	Source  string // profile, projects, experience, education, certificates, skills, resume, …
	Title   string
	Section string
	URL     string
	Content string
}

// Content is everything the knowledge base is built from.
type Content struct {
	Profile      *profile.Profile // nil when no profile exists yet
	Projects     []projects.Project
	Experience   []experience.Experience
	Education    []education.Education
	Certificates []certificates.Certificate
	Skills       []skills.Skill
	// ResumeText is the resume PDF converted to Markdown ("" if none).
	ResumeText string
	Markdown   []MarkdownFile
}

// MarkdownFile is an extra knowledge file from KNOWLEDGE_DIR.
type MarkdownFile struct {
	Name string // file name without extension, e.g. "achievements"
	Text string
}

// maxChunkChars keeps chunks focused (roughly 300–400 tokens). Smaller
// chunks make retrieval more precise; related facts stay together because
// text is only ever split between paragraphs.
const maxChunkChars = 1500

// BuildChunks turns portfolio content into chunks. It is a pure function:
// the same content always produces the same chunks and keys.
func BuildChunks(c Content) []Chunk {
	var out []Chunk
	name := "the portfolio owner"
	if c.Profile != nil && c.Profile.FullName != "" {
		name = c.Profile.FullName
	}

	if p := c.Profile; p != nil {
		out = append(out, profileChunks(p)...)
	}
	for _, p := range c.Projects {
		out = append(out, projectChunks(p, name)...)
	}
	for _, e := range c.Experience {
		out = append(out, experienceChunk(e, name))
	}
	for _, e := range c.Education {
		out = append(out, educationChunk(e, name))
	}
	for _, cert := range c.Certificates {
		out = append(out, certificateChunk(cert, name))
	}
	out = append(out, skillChunks(c.Skills, name)...)
	if c.ResumeText != "" {
		resumeURL := ""
		if c.Profile != nil {
			resumeURL = c.Profile.ResumeURL
		}
		out = append(out, markdownChunks("resume", "Resume", resumeURL, c.ResumeText)...)
	}
	for _, f := range c.Markdown {
		out = append(out, markdownChunks("knowledge:"+f.Name, titleFromFileName(f.Name), "", f.Text)...)
	}
	return out
}

func profileChunks(p *profile.Profile) []Chunk {
	var out []Chunk

	// About: headline + bio. A long bio is split between paragraphs.
	intro := p.FullName
	if p.Headline != "" {
		intro += " — " + p.Headline
	}
	var about strings.Builder
	fmt.Fprintf(&about, "About %s\n%s\n", p.FullName, intro)
	if p.Location != "" {
		fmt.Fprintf(&about, "Location: %s\n", p.Location)
	}
	for i, part := range packParagraphs(p.Bio, maxChunkChars) {
		text := part
		if i == 0 {
			text = about.String() + "\n" + part
		}
		out = append(out, Chunk{
			Key: fmt.Sprintf("profile:about:%d", i+1), Source: "profile",
			Title: "About " + p.FullName, Section: "About", URL: "/about", Content: text,
		})
	}
	if p.Bio == "" {
		out = append(out, Chunk{
			Key: "profile:about:1", Source: "profile",
			Title: "About " + p.FullName, Section: "About", URL: "/about", Content: about.String(),
		})
	}

	// Contact details get their own chunk so "how can I contact him?" finds them.
	var contact strings.Builder
	fmt.Fprintf(&contact, "How to contact %s\n", p.FullName)
	if p.Email != "" {
		fmt.Fprintf(&contact, "Email: %s\n", p.Email)
	}
	if p.Location != "" {
		fmt.Fprintf(&contact, "Location: %s\n", p.Location)
	}
	for _, l := range p.SocialLinks {
		fmt.Fprintf(&contact, "%s: %s\n", l.Platform, l.URL)
	}
	if p.ResumeURL != "" {
		fmt.Fprintf(&contact, "Resume (PDF): %s\n", p.ResumeURL)
	}
	contact.WriteString("The contact page of the portfolio is /contact.\n")
	out = append(out, Chunk{
		Key: "profile:contact", Source: "contact",
		Title: "Contact " + p.FullName, Section: "Contact", URL: "/contact", Content: contact.String(),
	})
	return out
}

func projectChunks(p projects.Project, owner string) []Chunk {
	var head strings.Builder
	fmt.Fprintf(&head, "Project by %s: %s\n", owner, p.Title)
	if p.IsFeatured {
		head.WriteString("Featured project.\n")
	}
	if p.Summary != "" {
		fmt.Fprintf(&head, "Summary: %s\n", p.Summary)
	}
	if len(p.Technologies) > 0 {
		fmt.Fprintf(&head, "Technologies used: %s\n", strings.Join(p.Technologies, ", "))
	}
	if p.GitHubURL != "" {
		fmt.Fprintf(&head, "Source code: %s\n", p.GitHubURL)
	}
	if p.LiveURL != "" {
		fmt.Fprintf(&head, "Live demo: %s\n", p.LiveURL)
	}

	url := "/projects/" + p.Slug
	parts := packParagraphs(p.Description, maxChunkChars)
	if len(parts) == 0 {
		parts = []string{""}
	}
	out := make([]Chunk, 0, len(parts))
	for i, part := range parts {
		// Every part repeats the project header, so each chunk makes sense
		// on its own when it is retrieved.
		text := head.String()
		if part != "" {
			text += "Description:\n" + part + "\n"
		}
		out = append(out, Chunk{
			Key: fmt.Sprintf("projects:%d:%d", p.ID, i+1), Source: "projects",
			Title: p.Title, Section: "Projects", URL: url, Content: text,
		})
	}
	return out
}

func experienceChunk(e experience.Experience, owner string) Chunk {
	var b strings.Builder
	fmt.Fprintf(&b, "Work experience of %s: %s at %s\n", owner, e.Position, e.Company)
	fmt.Fprintf(&b, "Period: %s\n", period(e.StartDate, e.EndDate, e.IsCurrent, "present (current job)"))
	if e.Location != "" {
		fmt.Fprintf(&b, "Location: %s\n", e.Location)
	}
	if e.Description != "" {
		fmt.Fprintf(&b, "Responsibilities and achievements:\n%s\n", truncateRunes(e.Description, maxChunkChars))
	}
	return Chunk{
		Key: fmt.Sprintf("experience:%d", e.ID), Source: "experience",
		Title: e.Position + " at " + e.Company, Section: "Experience", URL: "/experience", Content: b.String(),
	}
}

func educationChunk(e education.Education, owner string) Chunk {
	degree := e.Degree
	if e.FieldOfStudy != "" {
		degree += " in " + e.FieldOfStudy
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Education of %s: %s at %s\n", owner, degree, e.Institution)
	fmt.Fprintf(&b, "Period: %s\n", period(e.StartDate, e.EndDate, e.EndDate == nil, "present (in progress)"))
	if e.Location != "" {
		fmt.Fprintf(&b, "Location: %s\n", e.Location)
	}
	if e.Description != "" {
		fmt.Fprintf(&b, "Details:\n%s\n", truncateRunes(e.Description, maxChunkChars))
	}
	return Chunk{
		Key: fmt.Sprintf("education:%d", e.ID), Source: "education",
		Title: degree + ", " + e.Institution, Section: "Education", URL: "/education", Content: b.String(),
	}
}

func certificateChunk(c certificates.Certificate, owner string) Chunk {
	var b strings.Builder
	fmt.Fprintf(&b, "Certification of %s: %s\n", owner, c.Title)
	fmt.Fprintf(&b, "Issued by: %s\n", c.Issuer)
	fmt.Fprintf(&b, "Issue date: %s\n", c.IssueDate)
	if c.CredentialURL != "" {
		fmt.Fprintf(&b, "Credential: %s\n", c.CredentialURL)
	}
	return Chunk{
		Key: fmt.Sprintf("certificates:%d", c.ID), Source: "certificates",
		Title: c.Title, Section: "Certificates", URL: "/certificates", Content: b.String(),
	}
}

// skillChunks makes one chunk per category plus an overview listing every
// skill, which answers broad questions like "what technologies do you use?".
func skillChunks(list []skills.Skill, owner string) []Chunk {
	if len(list) == 0 {
		return nil
	}
	byCategory := map[string][]string{}
	var categories []string
	for _, s := range list {
		if _, ok := byCategory[s.Category]; !ok {
			categories = append(categories, s.Category)
		}
		byCategory[s.Category] = append(byCategory[s.Category], s.Name)
	}
	sort.Strings(categories)

	var overview strings.Builder
	fmt.Fprintf(&overview, "Skills and technologies of %s, by category:\n", owner)
	out := []Chunk{}
	for _, cat := range categories {
		names := strings.Join(byCategory[cat], ", ")
		fmt.Fprintf(&overview, "- %s: %s\n", cat, names)
		out = append(out, Chunk{
			Key: "skills:" + slug(cat), Source: "skills",
			Title: cat + " skills", Section: "Skills", URL: "/skills",
			Content: fmt.Sprintf("%s skills of %s: %s\n", cat, owner, names),
		})
	}
	return append([]Chunk{{
		Key: "skills:overview", Source: "skills",
		Title: "Skills overview", Section: "Skills", URL: "/skills", Content: overview.String(),
	}}, out...)
}

// markdownChunks splits Markdown at its headings, then packs each section's
// paragraphs into chunks. Chunk titles carry the heading for citations.
func markdownChunks(keyPrefix, title, url, text string) []Chunk {
	var out []Chunk
	n := 0
	for _, sec := range splitMarkdownSections(text) {
		for _, part := range packParagraphs(sec.body, maxChunkChars) {
			n++
			heading := title
			if sec.heading != "" {
				heading = title + " — " + sec.heading
			}
			source := keyPrefix
			if i := strings.IndexByte(source, ':'); i >= 0 {
				source = source[:i]
			}
			out = append(out, Chunk{
				Key: fmt.Sprintf("%s:%d", keyPrefix, n), Source: source,
				Title: title, Section: sec.heading, URL: url,
				Content: heading + "\n" + part,
			})
		}
	}
	return out
}

type mdSection struct {
	heading string
	body    string
}

var headingLine = regexp.MustCompile(`^#{1,6}\s+(.+?)\s*#*\s*$`)

// splitMarkdownSections splits text at Markdown headings (# … ######).
// Text before the first heading becomes a section without a heading.
func splitMarkdownSections(text string) []mdSection {
	var out []mdSection
	cur := mdSection{}
	var body strings.Builder
	flush := func() {
		cur.body = strings.TrimSpace(body.String())
		if cur.body != "" {
			out = append(out, cur)
		}
		body.Reset()
	}
	for _, line := range strings.Split(normalizeNewlines(text), "\n") {
		if m := headingLine.FindStringSubmatch(line); m != nil {
			flush()
			cur = mdSection{heading: strings.TrimSpace(m[1])}
			continue
		}
		body.WriteString(line)
		body.WriteByte('\n')
	}
	flush()
	return out
}

// packParagraphs groups paragraphs (separated by blank lines) into pieces of
// at most max characters. A single paragraph longer than max is split at
// sentence ends, and only as a last resort at the character limit.
func packParagraphs(text string, max int) []string {
	text = strings.TrimSpace(normalizeNewlines(text))
	if text == "" {
		return nil
	}
	var paragraphs []string
	for _, p := range blankLines.Split(text, -1) {
		if p = strings.TrimSpace(p); p != "" {
			paragraphs = append(paragraphs, splitLong(p, max)...)
		}
	}

	var out []string
	var cur strings.Builder
	for _, p := range paragraphs {
		if cur.Len() > 0 && utf8.RuneCountInString(cur.String())+2+utf8.RuneCountInString(p) > max {
			out = append(out, cur.String())
			cur.Reset()
		}
		if cur.Len() > 0 {
			cur.WriteString("\n\n")
		}
		cur.WriteString(p)
	}
	if cur.Len() > 0 {
		out = append(out, cur.String())
	}
	return out
}

var (
	sentenceEnd = regexp.MustCompile(`[.!?]\s+`)
	blankLines  = regexp.MustCompile(`\n\s*\n`)
)

func splitLong(p string, max int) []string {
	if utf8.RuneCountInString(p) <= max {
		return []string{p}
	}
	var out []string
	var cur strings.Builder
	rest := p
	for rest != "" {
		// Take up to and including the next sentence end.
		sentence := rest
		if loc := sentenceEnd.FindStringIndex(rest); loc != nil {
			sentence = rest[:loc[1]]
		}
		rest = rest[len(sentence):]
		for utf8.RuneCountInString(sentence) > max { // no sentence breaks at all
			r := []rune(sentence)
			out = append(out, string(r[:max]))
			sentence = string(r[max:])
		}
		if cur.Len() > 0 && utf8.RuneCountInString(cur.String())+utf8.RuneCountInString(sentence) > max {
			out = append(out, strings.TrimSpace(cur.String()))
			cur.Reset()
		}
		cur.WriteString(sentence)
	}
	if s := strings.TrimSpace(cur.String()); s != "" {
		out = append(out, s)
	}
	return out
}

func period(start string, end *string, current bool, ongoing string) string {
	if current || end == nil {
		return start + " to " + ongoing
	}
	return start + " to " + *end
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + "…"
}

func normalizeNewlines(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, "\r\n", "\n"), "\r", "\n")
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slug(s string) string {
	return strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(s), "-"), "-")
}

// titleFromFileName turns "open-source_work" into "Open source work".
func titleFromFileName(name string) string {
	t := strings.TrimSpace(strings.NewReplacer("-", " ", "_", " ").Replace(name))
	if t == "" {
		return "Portfolio notes"
	}
	r := []rune(t)
	return strings.ToUpper(string(r[0])) + string(r[1:])
}
