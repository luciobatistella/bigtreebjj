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
