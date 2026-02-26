# TierList+ Architecture

## Overview

Collaborative tier list and bracket voting web app. Users create templates (image sets), start sessions from them, and vote independently. Consensus is computed automatically.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL 17 (Docker) + Prisma 7 ORM
- **Drag & Drop**: @dnd-kit/core 6 + @dnd-kit/sortable 10
- **State**: Zustand 5 (tier list drag state)
- **Styling**: Tailwind CSS 4
- **Validation**: Zod 4
- **Images**: sharp (resize to 200x200 WebP on upload)
- **IDs**: nanoid (8-char join codes, excludes ambiguous chars)

## Database

Schema: `prisma/schema.prisma`
Config: `prisma.config.ts` (Prisma 7 requires this for DB URL)
Adapter: `@prisma/adapter-pg` (Prisma 7 driver adapter pattern)
Singleton: `src/lib/prisma.ts`

### Key Models

```
Template → TemplateItem (1:N)
Session → SessionItem (1:N, copied from TemplateItem at creation)
Session → Participant (1:N, identified by nickname)
Participant → TierVote (1:N, one vote per item)
Session → Bracket → BracketMatchup → BracketVote
```

- `SessionItem` is a **copy** of `TemplateItem` — editing a template doesn't break past sessions
- `tierConfig` on Session is **JSON** (`TierConfig[]`), not a separate table
- Participant identity is **localStorage-based** (`{ sessionId: participantId }`)

## Directory Structure

```
src/
  app/                          # Next.js App Router pages + API routes
    api/
      upload/                   # POST: image upload (FormData → sharp → /public/uploads/)
      templates/                # CRUD for templates and items
      sessions/                 # Session CRUD, join, votes, bracket, consensus
    templates/                  # Template pages (list, new, detail, edit)
    sessions/                   # Session pages (list, new, join, lobby, vote, bracket, results)
  components/
    layout/NavBar.tsx           # Top navigation
    templates/                  # TemplateEditor, ImageUploader
    sessions/                   # SessionLobby, NewSessionForm, TierConfigEditor
    tierlist/                   # TierListBoard, TierRow, UnrankedPool, DraggableItem
    bracket/BracketModal.tsx    # Client-side 1v1 bracket ranking modal
    ui/Button.tsx               # Primary/secondary/ghost button + buttonVariants for Links
    ui/Input.tsx                # Dark-theme form input
    shared/ImageUploader.tsx    # Drag-to-upload zone
  types/
    index.ts                    # Shared interfaces (Item, Matchup, BracketData, SessionData, etc.)
  lib/
    prisma.ts                   # PrismaClient singleton (with PrismaPg adapter)
    api-helpers.ts              # validateBody, notFound, badRequest, verifyParticipant
    constants.ts                # DEFAULT_TIER_CONFIG, TIER_COLORS, TierConfig type
    consensus.ts                # Consensus aggregation algorithm
    bracket-generator.ts        # Single-elimination bracket generation
    nanoid.ts                   # Join code generator
    upload.ts                   # Image processing (sharp resize → WebP)
    validators.ts               # Zod schemas for all API endpoints
    utils.ts                    # cn(), formatDate()
  hooks/
    useTierList.ts              # Zustand store for drag-and-drop state
    useParticipant.ts           # Read/write participant ID from localStorage
```

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/upload` | Upload image → resize → return URL |
| GET/POST | `/api/templates` | List / create templates |
| GET/PATCH/DELETE | `/api/templates/[templateId]` | Single template CRUD |
| POST | `/api/templates/[templateId]/items` | Add item to template |
| PATCH/DELETE | `/api/templates/[templateId]/items/[itemId]` | Update/delete item |
| GET/POST | `/api/sessions` | List / create sessions |
| POST | `/api/sessions/join` | Join with code + nickname → participant ID |
| GET/PATCH | `/api/sessions/[sessionId]` | Session detail / update status |
| GET/POST | `/api/sessions/[sessionId]/votes` | Get all votes / submit votes |
| GET | `/api/sessions/[sessionId]/votes/consensus` | Computed aggregate results |
| GET | `/api/sessions/[sessionId]/votes/[participantId]` | One participant's votes |
| GET/POST | `/api/sessions/[sessionId]/bracket` | Get / generate bracket |
| POST | `/api/sessions/[sessionId]/bracket/vote` | Submit bracket vote |
| POST | `/api/sessions/[sessionId]/bracket/advance` | Tally and advance bracket round |
| GET | `/api/sessions/[sessionId]/bracket/rankings` | Final bracket rankings |

## Core Algorithms

### Consensus (`src/lib/consensus.ts`)
- Each tier gets a numeric score (S=6, A=5, ..., F=1 for default config)
- For each item: average score across all voters
- Assign to tier with closest score value
- Sort within tier by average descending

### Bracket (`src/lib/bracket-generator.ts`)
- Shuffle items randomly
- Pad to next power of 2 (byes auto-advance)
- Single-elimination, majority vote per matchup (ties broken randomly)

## Running

```bash
docker compose up -d            # PostgreSQL on port 5433
npx prisma migrate dev          # Apply schema
npx tsx prisma/seed.ts          # Seed demo data (join code: DEMO1234)
npm run dev                     # http://localhost:3000
```

## Key Patterns

- Server components for data fetching (templates list, session lobby)
- Client components for interactivity (`"use client"` — editor, voting, join form)
- `useSearchParams()` wrapped in `<Suspense>` (Next.js 16 requirement)
- Prisma JSON fields cast with `as unknown as TierConfig[]` due to Prisma 7 strict typing
- Uploaded images stored in `public/uploads/` (local filesystem, gitignored)
- Shared types in `src/types/index.ts` — all domain interfaces imported from one place
- API route helpers (`validateBody`, `notFound`, `badRequest`, `verifyParticipant`) in `src/lib/api-helpers.ts`
- UI primitives (`Button`, `Input`, `buttonVariants`) in `src/components/ui/` — all buttons/inputs use these
