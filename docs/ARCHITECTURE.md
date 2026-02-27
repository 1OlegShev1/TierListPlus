# TierList+ Architecture

## Overview

Collaborative tier-list voting app with device-based identity.
Users create templates, start sessions, join with a code, and submit **per-user** tier votes.

Key product behaviors:
- Session privacy is **private by default** (`Session.isPrivate = true`)
- Hosts can **lock joins** (`Session.isLocked = true`) without closing the session
- Votes are tied to participant identity and cannot be submitted as another participant
- Bracket is a **personal assist tool** on the vote board (session-wide assist + per-tier rank assist)
- `/sessions/[sessionId]` resolves access then redirects to `/sessions/[sessionId]/vote` (vote-first flow)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL + Prisma 7
- **Validation**: Zod 4
- **State**: Zustand 5 (tier board state)
- **Drag and Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`
- **Styling**: Tailwind CSS 4
- **Images**: `sharp` (upload resize -> WebP)

## Data Model

Schema: `prisma/schema.prisma`

Important models and fields:

- `User`
  - Device-level identity (cookie-backed), optional `recoveryCode`
- `Session`
  - `creatorId`: host/owner
  - `isPrivate` (default `true`)
  - `isLocked` (default `false`)
  - `status`: `OPEN | CLOSED | ARCHIVED`
  - `tierConfig`: JSON tier definitions
- `Participant`
  - `userId` links participant to device identity
  - `submittedAt`: set when a complete vote submission succeeds
- `TierVote`
  - One row per `(participantId, sessionItemId)`
  - Stores `tierKey` + `rankInTier`

Recent migrations:
- `20260227110000_add_session_privacy_and_lock`
- `20260227123000_add_participant_submitted_at`

## Authorization Model

Identity:
1. Client ensures a device user (`/api/users`)
2. Server stores signed `HttpOnly` session cookie
3. API reads user ID from cookie (`src/lib/user-session.ts`)

Access rules:
- Session reads for private sessions require owner or joined participant (`requireSessionAccess`)
- Session mutate/delete requires owner (`requireSessionOwner`)
- Vote writes require participant ownership (`requireParticipantOwner`)
- Legacy shared bracket mutation endpoints are owner-only

Core helpers: `src/lib/api-helpers.ts`
- `requireSessionAccess`
- `requireSessionOwner`
- `requireParticipantOwner`
- `requireOpenSession`

## Voting Lifecycle

1. User joins session and gets/stores `participantId` locally.
2. Vote board loads:
   - session data
   - existing participant votes (if any) and seeds board for editing
   - local draft (if any) overrides seed
3. User can optionally run local bracket helpers:
   - session-level **Bracket Assist** (unranked toolbar) to seed full ordering
   - per-tier **Rank** button to refine ordering inside a single tier
4. Submission is accepted only when:
   - all session items are ranked
   - no duplicate vote item IDs
   - participant belongs to current cookie user
   - all `tierKey` values are valid for the session tier config
5. Server rewrites participant votes atomically (delete + createMany) and sets `participant.submittedAt`.
6. If user opens vote page without local participant context:
   - `OPEN` session -> redirect to join page with prefilled code
   - non-`OPEN` session -> redirect to results

Result visibility:
- Consensus uses all persisted `TierVote` rows
- Individual vote list in results uses derived `hasSubmitted`:
  - `submittedAt != null` OR participant has persisted tier votes

## Bracket Behavior

Primary product flow:
- Bracket is a local UX helper (`BracketModal`) in `TierListBoard`
- It seeds tier placement/order but users can continue editing before submit
- Session creation no longer asks to enable/disable bracket assist in UI

Routes under `/api/sessions/[sessionId]/bracket/*` still exist, but UI voting no longer depends on `/sessions/[sessionId]/bracket` page flow.

## API Surface

### Templates
- `GET/POST /api/templates`
- `GET/PATCH/DELETE /api/templates/[templateId]`
- `POST /api/templates/[templateId]/items`
- `PATCH/DELETE /api/templates/[templateId]/items/[itemId]`

### Sessions
- `GET/POST /api/sessions`
  - Anonymous `GET` returns public sessions
  - Authenticated `GET` returns public + owned + participated sessions
  - `POST` currently persists `bracketEnabled: true` for new sessions
- `POST /api/sessions/join`
  - Enforces `OPEN` and lock rules (`isLocked`)
- `GET/PATCH/DELETE /api/sessions/[sessionId]`
  - `PATCH/DELETE` owner-only
- `GET/POST /api/sessions/[sessionId]/votes`
  - `POST` requires complete ranking and participant ownership
- `GET /api/sessions/[sessionId]/votes/consensus`
- `GET /api/sessions/[sessionId]/votes/[participantId]`
  - Returns 404 when participant has no submitted votes

### Bracket (secondary/legacy server flow)
- `GET/POST /api/sessions/[sessionId]/bracket`
- `POST /api/sessions/[sessionId]/bracket/vote`
- `POST /api/sessions/[sessionId]/bracket/advance`
- `GET /api/sessions/[sessionId]/bracket/rankings`

### Users and Dashboard
- `POST /api/users`
- `GET /api/users/session`
- `POST /api/users/recover`
- `POST /api/users/[userId]/recovery`
- `GET /api/dashboard`

## Directory Notes

Key paths:
- `src/app/sessions/*`
  - `join`, `new`, `[sessionId]` (redirect), `[sessionId]/vote`, `[sessionId]/results`
- `src/components/tierlist/TierListBoard.tsx`
  - main vote UX, draft save, session/per-tier bracket assist, submit
- `src/components/bracket/BracketModal.tsx`
  - local bracket assist modal
- `src/app/api/sessions/*`
  - privacy, lock, vote, and session controls

## Run and Verify

```bash
docker compose up -d
npx prisma migrate deploy
npx prisma generate
npx tsc --noEmit
npm run lint
npm run dev
```
