# CLAUDE.md — Agent Instructions

## Project

TierList+ — collaborative tier list and bracket voting web app.

## Commands

- `npm run dev` — dev server (Turbopack, port 3000)
- `npm run build` — production build (use to check for TS errors)
- `npm run lint` — Biome lint check
- `npm run lint:fix` — Biome auto-fix
- `npx prisma migrate dev --name <name>` — create + apply migration
- `npx prisma generate` — regenerate client after schema changes
- `npx tsx prisma/seed.ts` — seed demo data
- `docker compose up -d` — start PostgreSQL (port 5433)

## Architecture

See `docs/ARCHITECTURE.md` for full details. Key points:

- Next.js 16 App Router (`src/app/`)
- Prisma 7 with `@prisma/adapter-pg` driver adapter (not the old `url` in schema pattern)
- `prisma.config.ts` holds the DB URL (with `dotenv/config` import)
- `src/lib/prisma.ts` — singleton PrismaClient with PrismaPg adapter
- Prisma JSON fields validated with `tierConfigSchema.parse()` (not `as unknown as T`)
- `useSearchParams()` must be wrapped in `<Suspense>`
- Tailwind 4 with `@tailwindcss/postcss` plugin (not the old `tailwind.config.js` pattern)
- Zod 4 — import from `zod/v4`

## Conventions

- Dark theme (neutral-950 bg, neutral-100 text, amber-400/500 accents)
- API routes return JSON, validate with Zod, use Prisma directly
- Client state for drag-and-drop managed by Zustand (`src/hooks/useTierList.ts`)
- Participant identity in localStorage, no auth system
- Images uploaded to `public/uploads/`, resized to 200x200 WebP via sharp
- Biome for linting and formatting (not ESLint/Prettier)
- Shared icon components in `src/components/ui/icons.tsx`

## Database

- PostgreSQL 17 via Docker on port **5433** (not 5432, which is used by another project)
- Connection string in `.env`: `DATABASE_URL="postgresql://postgres:postgres@localhost:5433/tierlistplus?schema=public"`
