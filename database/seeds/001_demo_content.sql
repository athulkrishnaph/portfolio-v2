-- Demo portfolio content, so the site looks complete right after setup.
-- Replace it from the admin portal, or edit this file.
--
-- Loaded by:  go run ./cmd/migrate seed          (empty database only)
--             go run ./cmd/migrate seed -force   (replaces existing content)
--
-- The runner executes this file inside a single transaction.
-- Admin users are NOT created here: use `go run ./cmd/createadmin`.

-- Start from a clean slate (content tables only, never users).
TRUNCATE social_links, profile, project_technologies, projects,
         certificates, experience, education, skills
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- Profile + social links
-- ---------------------------------------------------------------------------
INSERT INTO profile (id, full_name, headline, bio, email, location)
VALUES (
    1,
    'Alex Morgan',
    'Full-Stack Developer · Go & Angular',
    E'I build fast, reliable web applications end to end — from PostgreSQL schemas and Go APIs to polished Angular interfaces.\n\nI care about clean architecture, readable code and shipping features that make a real difference for users. When I''m not coding, I''m usually reading about distributed systems or contributing to open source.',
    'alex.morgan@example.com',
    'Remote · Europe'
);

INSERT INTO social_links (profile_id, platform, url, display_order) VALUES
    (1, 'GitHub',   'https://github.com/your-username',        1),
    (1, 'LinkedIn', 'https://www.linkedin.com/in/your-profile', 2),
    (1, 'X',        'https://x.com/your-handle',               3),
    (1, 'Blog',     'https://blog.example.com',                4);

-- ---------------------------------------------------------------------------
-- Projects + technologies
-- Each statement inserts a project and its technologies in one go: the CTE
-- returns the new project id, and unnest ... WITH ORDINALITY turns the array
-- into rows with a position number used as display_order.
-- ---------------------------------------------------------------------------
WITH p AS (
    INSERT INTO projects (title, slug, summary, description, github_url, live_url, is_featured, display_order)
    VALUES (
        'Task Flow',
        'task-flow',
        'A collaborative Kanban board with real-time updates and role-based access.',
        E'Task Flow is a team task manager inspired by Trello.\n\nHighlights:\n- Drag-and-drop boards, lists and cards\n- Real-time updates over WebSockets\n- Role-based permissions for owners, members and guests\n- REST API written in Go with PostgreSQL row-level locking for safe concurrent edits',
        'https://github.com/your-username/task-flow',
        'https://task-flow.example.com',
        true, 1)
    RETURNING id
)
INSERT INTO project_technologies (project_id, name, display_order)
SELECT p.id, t.name, t.ord
FROM p, unnest(ARRAY['Go', 'Angular', 'PostgreSQL', 'WebSockets', 'Docker']) WITH ORDINALITY AS t(name, ord);

WITH p AS (
    INSERT INTO projects (title, slug, summary, description, github_url, live_url, is_featured, display_order)
    VALUES (
        'ShopLite API',
        'shoplite-api',
        'A lightweight e-commerce REST API with JWT auth, carts, orders and Stripe payments.',
        E'ShopLite is a headless e-commerce backend.\n\nIt exposes a documented REST API for products, carts and orders, uses JWT authentication, and integrates Stripe for payments with idempotent webhook handling. The service has 85% test coverage and runs in Docker.',
        'https://github.com/your-username/shoplite-api',
        '',
        true, 2)
    RETURNING id
)
INSERT INTO project_technologies (project_id, name, display_order)
SELECT p.id, t.name, t.ord
FROM p, unnest(ARRAY['Go', 'PostgreSQL', 'JWT', 'Stripe', 'OpenAPI']) WITH ORDINALITY AS t(name, ord);

WITH p AS (
    INSERT INTO projects (title, slug, summary, description, github_url, live_url, is_featured, display_order)
    VALUES (
        'Weather Lens',
        'weather-lens',
        'A responsive weather dashboard with charts, forecasts and saved locations.',
        E'Weather Lens shows current conditions and a 7-day forecast for any city.\n\nBuilt with Angular and RxJS: search is debounced, requests are cancelled when the query changes, and results are cached per location. Charts render temperature and precipitation trends.',
        'https://github.com/your-username/weather-lens',
        'https://weather-lens.example.com',
        true, 3)
    RETURNING id
)
INSERT INTO project_technologies (project_id, name, display_order)
SELECT p.id, t.name, t.ord
FROM p, unnest(ARRAY['Angular', 'TypeScript', 'RxJS', 'SCSS', 'Chart.js']) WITH ORDINALITY AS t(name, ord);

WITH p AS (
    INSERT INTO projects (title, slug, summary, description, github_url, live_url, is_featured, display_order)
    VALUES (
        'LogPipe',
        'logpipe',
        'A CLI tool that tails, filters and ships structured logs to multiple destinations.',
        E'LogPipe is a small command-line tool for working with JSON logs.\n\nIt can tail files, filter with simple expressions, and forward matching lines to stdout, files or HTTP endpoints concurrently using worker pools.',
        'https://github.com/your-username/logpipe',
        '',
        false, 4)
    RETURNING id
)
INSERT INTO project_technologies (project_id, name, display_order)
SELECT p.id, t.name, t.ord
FROM p, unnest(ARRAY['Go', 'CLI', 'Concurrency']) WITH ORDINALITY AS t(name, ord);

-- ---------------------------------------------------------------------------
-- Experience (a current job has end_date NULL and is_current = true)
-- ---------------------------------------------------------------------------
INSERT INTO experience (company, position, location, description, start_date, end_date, is_current, display_order) VALUES
    ('Northwind Software', 'Senior Full-Stack Developer', 'Remote',
     E'Lead developer on the customer portal (Angular + Go).\n- Designed REST APIs used by 40k+ monthly users\n- Cut page load time by 45% through lazy loading and API caching\n- Mentored three junior developers',
     '2023-03-01', NULL, true, 1),
    ('Brightpath Labs', 'Backend Developer', 'Berlin, Germany',
     E'Built and maintained Go microservices for a logistics platform.\n- Migrated a monolith endpoint set to services backed by PostgreSQL\n- Introduced structured logging and tracing',
     '2020-09-01', '2023-02-28', false, 2),
    ('Pixel & Co', 'Junior Web Developer', 'Lisbon, Portugal',
     E'Developed responsive marketing sites and internal tools with Angular and TypeScript.',
     '2019-01-15', '2020-08-31', false, 3);

-- ---------------------------------------------------------------------------
-- Education
-- ---------------------------------------------------------------------------
INSERT INTO education (institution, degree, field_of_study, location, description, start_date, end_date, display_order) VALUES
    ('University of Lisbon', 'BSc', 'Computer Science', 'Lisbon, Portugal',
     'Focus on software engineering, databases and distributed systems. Final project: a real-time collaborative editor.',
     '2015-09-01', '2018-07-15', 1),
    ('Online', 'Professional Certificate', 'Cloud Native Development', 'Remote',
     'Containers, Kubernetes fundamentals and CI/CD pipelines.',
     '2021-01-10', '2021-06-30', 2);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
INSERT INTO certificates (title, issuer, issue_date, credential_url, display_order) VALUES
    ('Certified Kubernetes Application Developer (CKAD)', 'The Linux Foundation', '2024-05-20', 'https://www.credly.com/', 1),
    ('AWS Certified Developer – Associate',               'Amazon Web Services',  '2023-11-02', 'https://aws.amazon.com/certification/', 2),
    ('PostgreSQL Essentials',                             'EDB',                  '2022-08-14', 'https://www.enterprisedb.com/', 3);

-- ---------------------------------------------------------------------------
-- Skills (grouped by category on the public Skills page)
-- ---------------------------------------------------------------------------
INSERT INTO skills (name, category, display_order) VALUES
    ('Go',            'Backend',  1),
    ('REST APIs',     'Backend',  2),
    ('PostgreSQL',    'Backend',  3),
    ('Redis',         'Backend',  4),
    ('Angular',       'Frontend', 1),
    ('TypeScript',    'Frontend', 2),
    ('RxJS',          'Frontend', 3),
    ('SCSS',          'Frontend', 4),
    ('HTML & CSS',    'Frontend', 5),
    ('Docker',        'DevOps',   1),
    ('GitHub Actions','DevOps',   2),
    ('Linux',         'DevOps',   3),
    ('Git',           'Tools',    1),
    ('VS Code',       'Tools',    2),
    ('Postman',       'Tools',    3);
