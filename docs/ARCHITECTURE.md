# TierList+ Architecture

## Overview

Collaborative tier list and bracket voting web app. Users create templates (image sets), start sessions from them, and vote independently. Consensus is computed automatically. A lightweight device-based identity system tracks ownership for templates and sessions, with optional recovery codes for cross-device access.

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
User → Template (1:N, creator)
User → Session (1:N, creator)
User → Participant (1:N, links device identity to session participation)
Template → TemplateItem (1:N)
Session → SessionItem (1:N, copied from TemplateItem at creation)
Session → Participant (1:N, identified by nickname)
Participant → TierVote (1:N, one vote per item, includes rankInTier)
Session → Bracket → BracketMatchup → BracketVote
```

- `User` — device-based identity (auto-created on first visit), optional `recoveryCode` for cross-device access
- `Template` and `Session` have an optional `creatorId` FK to `User` (enables owner-only deletion)
- `Participant` has an optional `userId` FK to `User` (links session participation to device identity)
- `SessionItem` is a **copy** of `TemplateItem` — editing a template doesn't break past sessions
- `tierConfig` on Session is **JSON** (`TierConfig[]`), not a separate table
- `TierVote` stores `rankInTier` for within-tier item ordering

## Directory Structure

```
src/
  app/                          # Next.js App Router pages + API routes
    api/
      upload/                   # POST: image upload (FormData → sharp → /public/uploads/)
      templates/                # CRUD for templates and items
      sessions/                 # Session CRUD, join, votes, bracket, consensus
      users/                    # User creation, recovery code flow
      dashboard/                # Dashboard data (created/participated content)
    templates/                  # Template pages (list, new, detail, edit)
    sessions/                   # Session pages (list, new, join, lobby, vote, bracket, results)
                                #   results: consensus view + ?participant=<id> for individual votes
    dashboard/                  # User dashboard page
  components/
    layout/NavBar.tsx           # Top navigation
    templates/                  # TemplateEditor, DeleteTemplateButton
    sessions/                   # SessionLobby, NewSessionForm, DeleteSessionButton
    tierlist/                   # TierListBoard, TierRow, TierRowActions, TierColorPicker,
                                #   UnrankedPool, DraggableItem
    bracket/                    # BracketModal, MatchupVoter
    dashboard/                  # DashboardContent, RecoverySection
    ui/                         # Button, Input, Textarea, Select, ConfirmDialog,
                                #   PageHeader, StatusBadge, JoinCodeBanner,
                                #   Loading, ErrorMessage, icons
    shared/ImageUploader.tsx    # Drag-to-upload zone
  types/
    index.ts                    # Shared interfaces (Item, Matchup, BracketData, SessionData, etc.)
  lib/
    prisma.ts                   # PrismaClient singleton (with PrismaPg adapter)
    api-helpers.ts              # validateBody, notFound, badRequest, verifyParticipant, getUserId
    api-client.ts               # Client-side HTTP helper (JSON/error wrapper)
    constants.ts                # DEFAULT_TIER_CONFIG, TIER_COLORS, TierConfig type
    consensus.ts                # Consensus aggregation algorithm (with within-tier ranking)
    bracket-generator.ts        # Single-elimination bracket generation
    bracket-helpers.ts          # Bracket utility functions
    bracket-ranking.ts          # Final bracket ranking computation
    nanoid.ts                   # Join code generator
    upload.ts                   # Image processing (sharp resize → WebP)
    validators.ts               # Zod schemas for all API endpoints
    utils.ts                    # cn(), formatDate()
    device-identity.ts          # Device ID generation + localStorage persistence
    recovery-code.ts            # Recovery code generation (word-based)
    vote-draft.ts               # Vote draft auto-save to localStorage
  hooks/
    useTierList.ts              # Zustand store for drag-and-drop state + draft persistence
    useParticipant.ts           # Read/write participant ID from localStorage
    useUser.ts                  # Device-based user identity (auto-create User, recovery)
```

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/upload` | Upload image → resize → return URL |
| GET/POST | `/api/templates` | List / create templates (attaches creatorId) |
| GET/PATCH/DELETE | `/api/templates/[templateId]` | Single template CRUD (DELETE: owner-only) |
| POST | `/api/templates/[templateId]/items` | Add item to template |
| PATCH/DELETE | `/api/templates/[templateId]/items/[itemId]` | Update/delete item |
| GET/POST | `/api/sessions` | List / create sessions (attaches creatorId) |
| POST | `/api/sessions/join` | Join with code + nickname → participant ID (links userId) |
| GET/PATCH/DELETE | `/api/sessions/[sessionId]` | Session detail / update status / delete (owner-only) |
| GET/POST | `/api/sessions/[sessionId]/votes` | Get all votes / submit votes |
| GET | `/api/sessions/[sessionId]/votes/consensus` | Computed aggregate results |
| GET | `/api/sessions/[sessionId]/votes/[participantId]` | One participant's votes |
| GET/POST | `/api/sessions/[sessionId]/bracket` | Get / generate bracket |
| POST | `/api/sessions/[sessionId]/bracket/vote` | Submit bracket vote |
| POST | `/api/sessions/[sessionId]/bracket/advance` | Tally and advance bracket round |
| GET | `/api/sessions/[sessionId]/bracket/rankings` | Final bracket rankings |
| POST | `/api/users` | Create user (device identity) |
| POST | `/api/users/recover` | Recover account via recovery code |
| GET | `/api/users/[userId]/recovery` | Get/generate recovery code |
| GET | `/api/dashboard` | User's created templates, sessions, and participations |

## Core Algorithms

### Consensus (`src/lib/consensus.ts`)
- Each tier gets a numeric score (top tier = highest, based on sortOrder)
- For each item: average score across all voters
- Within-tier ordering uses `rankInTier` as a tiebreaker: normalized to a fractional bonus in [0, 1) so it can never cross a tier boundary
- Assign to tier with closest score value
- Sort within tier by average score descending

### Bracket (`src/lib/bracket-generator.ts`)
- Shuffle items randomly
- Pad to next power of 2 (byes auto-advance)
- Single-elimination, majority vote per matchup (ties broken randomly)

## User Identity

Device-based identity system (no authentication):

1. On first visit, `device-identity.ts` generates a device ID stored in localStorage
2. `useUser` hook auto-creates a `User` record via `POST /api/users`
3. Server sets an `HttpOnly` signed session cookie on identity creation/recovery
4. API routes read user identity from the signed cookie (`api-helpers.ts`)
5. Templates and sessions record `creatorId` — only the creator can mutate/delete them
5. Optional recovery codes (word-based) allow restoring identity on a new device

## Vote Draft Persistence

Vote placements are auto-saved to localStorage (`vote-draft.ts`):

- Debounced 300ms auto-save of tier/unranked state
- Restored on page load with a "Draft restored" banner
- Cleared after successful vote submission
- `beforeunload` warning when items are ranked but not submitted
- Draft validation handles added/removed items and changed tier keys

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
- Prisma JSON fields validated at runtime with `tierConfigSchema.parse()` from Zod
- Uploaded images stored in `public/uploads/` (local filesystem, gitignored)
- Shared types in `src/types/index.ts` — all domain interfaces imported from one place
- API route helpers (`validateBody`, `notFound`, `badRequest`, `verifyParticipant`, `getUserId`) in `src/lib/api-helpers.ts`
- UI primitives (`Button`, `Input`, `Textarea`, `Select`, `ConfirmDialog`, `buttonVariants`) in `src/components/ui/`
- Owner-only deletion with `ConfirmDialog` confirmation modals
- `api-client.ts` wraps fetch for JSON/error handling on client-side requests
