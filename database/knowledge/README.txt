Extra knowledge for the portfolio AI assistant
==============================================

Most of what the assistant knows comes straight from the database (profile,
projects, experience, education, certificates, skills) and from your uploaded
resume PDF, so normally you do not need this folder.

Use it for information that has no place in the admin portal, for example
achievements, awards, talks, publications or volunteering. Add one Markdown
file per topic:

    database/knowledge/achievements.md

    # Achievements

    ## Hackathon winner 2025
    Won first place at ... with a team of four ...

    ## Open source
    Maintainer of ...

Rules:
- Only *.md files are read. Files starting with "_" or "README" are ignored.
- Text is split at headings (#, ##, ...), so use one heading per topic.
- Everything here can be quoted to site visitors. Do not put private data here.
- After adding or editing files, rebuild the knowledge base: admin dashboard →
  "Rebuild knowledge", or `go run ./cmd/ingest` from backend/.
