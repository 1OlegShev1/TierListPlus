# TierList+ Architecture

## Overview

Collaborative tier-list voting app with device-based identity.
Users create templates, start sessions, join with a code, and submit **per-user** tier votes.

Key product behaviors:
- Session privacy is **private by default** (`Session.isPrivate = true`)
- Template visibility is **private by default** (`Template.isPublic = false`)
- Every new session gets a **hidden working template** so hosts can edit session items live, then publish or copy detached snapshots of that item set later
- Hosts can **lock joins** (`Session.isLocked = true`) without closing the session
- Hosts can **close** voting when a session is done and **reopen** it later if needed
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
- **Images**: `sharp` (authenticated upload resize -> WebP, per-device rate-limited)

## Data Model

Schema: `prisma/schema.prisma`

Important models and fields:

- `User`
  - Device-level identity (cookie-backed), optional `recoveryCode`
- `Device`
  - One browser/device per user identity, revocable without deleting the user
- `LinkCode`
  - Short-lived code used to link an additional device to an existing user
- `Template`
  - `isPublic` controls list visibility
  - `isHidden` marks internal working templates created for sessions and excludes them from normal template browsing
- `Session`
  - `sourceTemplateId`: original visible template used to seed the working copy (nullable)
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
- `20260302110000_add_template_visibility`
- `20260302133000_add_devices_and_link_codes`
- `20260302153000_enforce_unique_user_participant_per_session`
- `20260302170000_add_hidden_working_templates`
- `20260305100000_add_spaces`
- `20260305113000_enforce_space_resource_invariants`

Space model (v1.1):
- `Space`
  - `visibility`: `PRIVATE | OPEN`
  - owner is represented as a `SpaceMember` with role `OWNER` and also as `creatorId`
- `SpaceMember`
  - roles: `OWNER | MEMBER`
  - unique `(spaceId, userId)`
- `SpaceInvite`
  - reusable invite code for private spaces, expirable/revocable
- `Template.spaceId` and `Session.spaceId` are nullable
  - `spaceId = null` means personal/public feed resources
  - `spaceId != null` means space-scoped resources
  - DB checks enforce:
    - `Template.spaceId IS NULL OR Template.isPublic = false`
    - `Session.spaceId IS NULL OR Session.isPrivate = true`

## Authorization Model

Detailed matrix (actors, resources, states, and layer mapping):
- `docs/PERMISSIONS.md`

Identity:
1. Client ensures a device-backed identity (`/api/users`)
2. Server stores a signed `HttpOnly` session cookie for `userId + deviceId`
3. API reads that identity from the cookie (`src/lib/user-session.ts`)
4. Device linking and recovery flows can mint `LinkCode`s and revoke stale `Device`s without changing the underlying user

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

Space access rules:
- Private spaces: members-only read
- Open spaces: anonymous read for space/list/session/result content
- Open spaces still require signed-in users to vote
- List/session mutation in spaces: `creator OR space owner`

Policy + resolver boundary:
- `src/domain/policy/access.ts`
  - pure authorization decisions (no DB calls)
- `src/domain/policy/resolvers.ts`
  - DB-backed access context resolvers for space/session/template
- `src/domain/*/service.ts`
  - route-facing business operations
  - call resolvers + policy functions
  - keep route handlers thin and consistent

## Voting Lifecycle

Host controls:
- `OPEN`
  - New participants may join (unless `isLocked`)
  - Existing participants may submit or update rankings
- `CLOSED`
  - No new joins
  - Vote board is no longer accepting changes
  - Results remain visible
- Owners can transition `OPEN -> CLOSED` (close vote) and `CLOSED -> OPEN` (reopen vote)

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

Home/dashboard visibility:
- Home surfaces only `OPEN` sessions
- Closed sessions move out of home and remain discoverable from the main Votes page

## Bracket Behavior

Primary product flow:
- Bracket is a local UX helper (`BracketModal`) in `TierListBoard`
- It seeds tier placement/order but users can continue editing before submit
- Session creation no longer asks to enable/disable bracket assist in UI

No bracket trees or bracket votes are persisted server-side; bracket assist is local-only.

## API Surface

### Templates
- `GET/POST /api/templates`
  - Anonymous `GET` returns public non-hidden templates
  - Authenticated `GET` returns public + owned non-hidden templates
  - `previewLimit=<N>` includes up to 4 preview images on only the first `N` templates
- `GET/PATCH/DELETE /api/templates/[templateId]`
  - `GET` requires template to be non-hidden and public or owned
  - `PATCH/DELETE` are owner-only and reject hidden working templates
- `POST /api/templates/[templateId]/duplicate`
  - Creates a new private owned copy from any accessible template
- `POST /api/templates/[templateId]/items`
- `PATCH/DELETE /api/templates/[templateId]/items/[itemId]`

### Sessions
- `GET/POST /api/sessions`
  - Anonymous `GET` returns public sessions
  - Authenticated `GET` returns public + owned + participated sessions
  - `POST` always creates a private hidden working template, optionally seeded from `templateId`
  - `POST` stores `sourceTemplateId` when a visible template was used as the starting point
- `POST /api/sessions/join`
  - Enforces `OPEN` and lock rules (`isLocked`)
- `GET/PATCH/DELETE /api/sessions/[sessionId]`
  - `GET` includes participant completion summary plus `templateIsHidden`
  - `PATCH/DELETE` owner-only
  - `PATCH` may update `status`, `isPrivate`, `isLocked`, and `tierConfig`
- `POST /api/sessions/[sessionId]/items`
  - Owner-only, `OPEN` sessions only, and only for sessions backed by a hidden working template
- `DELETE /api/sessions/[sessionId]/items/[itemId]`
  - Same access rules as add-item; refuses removal after saved votes exist for that item
- `POST /api/sessions/[sessionId]/template`
  - Owner can publish the current session items as a new detached visible template snapshot (inherits session public/private visibility)
  - The hidden working template remains internal to the session and is never exposed as a normal template
  - Any other authenticated user with session access can save a private detached copy of the current session items
- `GET/POST /api/sessions/[sessionId]/votes`
  - `POST` requires complete ranking and participant ownership
- `GET /api/sessions/[sessionId]/votes/consensus`
- `GET /api/sessions/[sessionId]/votes/[participantId]`
  - Returns 404 when participant has no submitted votes

### Users and Dashboard
- `POST /api/users`
- `GET /api/users/session`
- `POST /api/users/recover`
- `POST /api/users/[userId]/recovery`
- `GET /api/users/devices`
- `DELETE /api/users/devices/[deviceId]`
- `GET /api/dashboard`

## Directory Notes

Key paths:
- `src/app/sessions/*`
  - `join`, `new`, `[sessionId]` (redirect), `[sessionId]/vote`, `[sessionId]/results`
- `src/components/tierlist/TierListBoard.tsx`
  - main vote UX, draft save, live session item editing for hidden working templates, session/per-tier bracket assist, submit
- `src/components/bracket/BracketModal.tsx`
  - local bracket assist modal
- `src/app/api/sessions/*`
  - privacy, lock, live item editing, template publish/copy, vote, and session controls

## Run and Verify

```bash
docker compose up -d
npx prisma migrate deploy
npx prisma generate
npx tsc --noEmit
npm run lint
npm run dev
```
