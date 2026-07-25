# The Big Tree BJJ

The Big Tree BJJ is a local-first monorepo for building a trusted and auditable database of Brazilian Jiu-Jitsu lineage.

## Architecture

- Apps
  - web: Next.js + TypeScript public site and admin shell
  - api: Node.js + TypeScript API with Swagger docs
- Workers
  - collectors: Python-based collectors and importers
- Packages
  - database: Prisma schema, migrations, and seed data
  - shared-types: shared TypeScript models
  - ui: reusable UI components

## Local development

1. Copy .env.example to .env
2. Start PostgreSQL, Redis, API, and web via Docker Compose
3. Run database migrations and seed data

### Commands

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Local URLs

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/docs

## Notes

- Demo data is intentionally technical and unverified.
- The lineage rules are encoded as application guidance and schema conventions.
- The system is designed to support future importers, curator review, and Docker-based deployment to a VPS.

## BJJ Heroes Discovery Connector

The BJJ Heroes Discovery Connector is a review-first discovery source for minimal structured research facts: person names, nicknames, listed team text, profile URLs, and possible lineage clues. It is not a clone, mirror, scraper for editorial content, or image downloader.

### Legal and Editorial Boundaries

Do not copy full biographies, profile images, full articles, championship tables, fighter statistics, or long excerpts. The connector parses profile HTML in memory, discards it, and stores only:

- source URL;
- capture date;
- content hash;
- parsed structured fields;
- short source locators such as `profile metadata`, `introductory paragraph`, or `listed team field`;
- excerpts capped at 160 characters.

Every candidate remains `pending_review`. No people, organizations, affiliations, evidence, or lineage claims are published automatically.

### Conservative Mode

Conservative mode is the default. It allows catalogue discovery and curator-selected profile URLs or small batches. The default profile limit is 20, with one request at a time, an 8 second delay, and 2-5 seconds of random jitter.

```bash
python -m workers.collectors.bjjheroes.run_catalog --dry-run --limit 10
```

### Run a 10-Profile Dry-Run

```bash
python -m workers.collectors.bjjheroes.run_profiles \
  --dry-run \
  --limit 10 \
  --profile-url https://www.bjjheroes.com/bjj-fighters/example-profile
```

The Python connector outputs normalized JSON only. The Node API creates review-first ImportJob, ImportRow, DuplicateCandidate, ReviewQueue, and ChangeHistory records.

### Review Imported Candidates

Use:

- Source status: http://localhost:3000/admin/sources/bjjheroes
- Manual profile imports: http://localhost:3000/admin/imports/bjjheroes
- Import jobs: http://localhost:3000/admin/imports
- Duplicate review: http://localhost:3000/admin/review/duplicates

Each imported source record includes:

```text
Source: BJJ Heroes
Source URL: original profile URL
Use: Specialized discovery source
Editorial status: Requires review before lineage publication
```

### Partner Authorization

The `authorized_partner` mode is disabled by default. It must not be used unless explicit authorization has been configured.

```bash
set BJJHEROES_AUTHORIZED_PARTNER=true
python -m workers.collectors.bjjheroes.run_profiles --mode authorized_partner --limit 50 --profile-url https://www.bjjheroes.com/bjj-fighters/example-profile
```

Without `BJJHEROES_AUTHORIZED_PARTNER=true`, partner mode fails closed.
