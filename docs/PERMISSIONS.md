# TierList+ Permissions Matrix

This document is the source of truth for who can do what across spaces, lists, votes, and ballots.

It is intentionally redundant with code comments so policy changes are easier to review.

## Scope

This covers:
- Read and mutate permissions for spaces, templates (lists), sessions (votes), and ballots
- Session state transitions (`OPEN`, `CLOSED`, `ARCHIVED`) and join lock (`isLocked`)
- How permissions are enforced across layers (policy, resolver, API, page guards, UI)
- Share-link behavior for open and closed votes

This does not cover:
- Infrastructure/network security controls
- Device recovery/rotation internals beyond access impact

## Actors

- `Anonymous`: no authenticated device identity
- `Authenticated`: signed-in device identity
- `Session owner`: `session.creatorId === requestUserId`
- `Participant`: row exists in `Participant` for `(sessionId, userId)`
- `Space member`: `SpaceMember` exists
- `Space owner`: `space.creatorId === requestUserId` OR member role is `OWNER`

## Enforcement Layers

1. Policy (pure, no DB)
- `src/domain/policy/access.ts`
- `canReadSpace`, `canReadSession`, `canReadTemplate`, `canMutateResource`

2. Resolver (DB-backed access context)
- `src/domain/policy/resolvers.ts`
- Produces `isOwner`, `isParticipant`, `isSpaceMember`, `isSpaceOwner`, visibility context

3. API guard helpers
- `src/lib/api-helpers.ts`
- `requireSessionAccess`, `requireSessionOwner`, `requireParticipantOwner`, `requireSpaceMember`, `requireOpenSession`

4. Page-level guards (server components)
- `src/app/sessions/[sessionId]/page.tsx`
- `src/app/sessions/[sessionId]/vote/page.tsx`
- `src/app/sessions/[sessionId]/results/page.tsx`
- `src/app/spaces/[spaceId]/page.tsx`

5. UI visibility controls (non-authoritative)
- Buttons/components hide or show actions based on user/session state
- Server/API still enforce true authorization

## Space Permissions

Resource: `Space`

- Read private space:
  - Allowed: members
  - Denied: non-members
- Read open space:
  - Allowed: everyone
- Mutate space settings:
  - Allowed: space owner only

Related files:
- `src/domain/policy/access.ts`
- `src/domain/spaces/service.ts`
- `src/app/spaces/[spaceId]/page.tsx`

## Template (List) Permissions

Resource: `Template`

Personal templates (`spaceId = null`):
- Read:
  - Public + non-hidden: everyone
  - Private + non-hidden: owner only
  - Hidden: never directly readable in browsing flows
- Mutate/delete:
  - Owner only

Space templates (`spaceId != null`):
- Visibility follows space readability
- Mutate/delete:
  - `creator OR space owner` (service/API dependent by route)

Related files:
- `src/domain/policy/access.ts`
- `src/domain/templates/service.ts`
- `src/lib/template-access.ts`
- `src/app/api/templates/*`
- `src/app/api/spaces/[spaceId]/templates/*`

## Session (Vote) Permissions

Resource: `Session`

### Read access (general)

Personal session (`spaceId = null`):
- Public (`isPrivate = false`): everyone
- Private (`isPrivate = true`): owner or joined participant
- Exception: closed private results can be shared by join code (see Share section)

Space session (`spaceId != null`):
- Open space: readable by everyone
- Private space: members only

### Mutations

- Update/delete session:
  - `owner OR space owner` via `requireSessionOwner`
- Change `isPrivate`:
  - Allowed only for personal sessions; space sessions remain private by invariant
- Add/edit/remove session items:
  - Requires open session and hidden working-template rules (`canManageSessionItems`)

Related files:
- `src/lib/api-helpers.ts`
- `src/app/api/sessions/[sessionId]/route.ts`
- `src/app/api/sessions/[sessionId]/items/*`
- `src/app/sessions/[sessionId]/vote/page.tsx`
- `src/app/sessions/[sessionId]/results/page.tsx`

## Join and Voting Permissions

Resource: join flow + vote submissions

- Join requires authenticated device identity
- Join by code (`POST /api/sessions/join`):
  - Session must be `OPEN`
  - If `isLocked`, new participants are blocked
  - Private space sessions require space membership
- Submit/update votes:
  - Participant ownership is required (`requireParticipantOwner`)
  - Session must be open (`requireOpenSession`)
  - Vote payload must be complete and valid

Related files:
- `src/app/api/sessions/join/route.ts`
- `src/app/api/sessions/[sessionId]/votes/route.ts`
- `src/lib/api-helpers.ts`

## Results and Ballot Visibility

Resource: `/sessions/[sessionId]/results`

Baseline:
- Follows session read rules above

Private closed share exception (personal sessions only):
- If session is private, closed/non-open, not space-scoped, and `?code=<joinCode>` matches:
  - Non-participant outsiders may view results
  - View is consensus-only (no individual participant ballot tabs)

Explicitly not bypassed:
- Private space membership requirements
- Personal private open-session access (still requires owner/participant to view session pages directly)

Related files:
- `src/app/sessions/join/page.tsx`
- `src/app/sessions/[sessionId]/results/page.tsx`
- `src/app/sessions/[sessionId]/results/ResultsPageClient.tsx`

## Share-Link Behavior

Share UI:
- Owner-only action from vote cards
- Always shares join-code URL: `/sessions/join?code=<JOIN_CODE>`
- QR encodes the same URL (transport convenience only)

Landing behavior:
- If target session is open: join page flow
- If target session is closed/non-open: redirect to `/sessions/{id}/results?code=<JOIN_CODE>`

Security model:
- The URL itself does not grant global bypass
- Server-side checks decide what that link may access
- For private closed personal votes, code grants consensus-only results

Related files:
- `src/components/sessions/ShareVoteButton.tsx`
- `src/app/sessions/join/page.tsx`
- `src/app/sessions/[sessionId]/results/page.tsx`

## Quick Matrix

### Sessions (Votes)

| Scope | Visibility | Status | Actor | Read session page | Join | View results | View individual ballots |
|---|---|---|---|---|---|---|---|
| Personal | Public | OPEN | Anyone | Yes | Yes (auth required to complete join) | Yes | Yes |
| Personal | Public | CLOSED | Anyone | Redirect to results | No | Yes | Yes |
| Personal | Private | OPEN | Owner/Participant | Yes | Yes via code (auth required) | Yes (if readable) | Yes |
| Personal | Private | OPEN | Outsider | No | Yes via code if not locked | No until joined | N/A |
| Personal | Private | CLOSED | Owner/Participant | Yes (results) | No | Yes | Yes |
| Personal | Private | CLOSED | Outsider w/ matching code | No vote page | No | Yes | No (consensus only) |
| Personal | Private | CLOSED | Outsider no code | No | No | No | No |
| Space OPEN | (Space rule) | OPEN/CLOSED | Anyone | Yes | Join rules still apply | Yes | Yes |
| Space PRIVATE | (Space rule) | OPEN/CLOSED | Member | Yes | Yes | Yes | Yes |
| Space PRIVATE | (Space rule) | OPEN/CLOSED | Non-member | No | No | No | No |

### Templates (Lists)

| Scope | Visibility | Actor | Read | Mutate/Delete |
|---|---|---|---|---|
| Personal | Public + non-hidden | Anyone | Yes | Owner only |
| Personal | Private + non-hidden | Owner | Yes | Owner only |
| Personal | Private + non-hidden | Non-owner | No | No |
| Personal | Hidden | Anyone | No (direct browse) | Internal/owner workflows only |
| Space OPEN | Space-readable | Anyone | Yes | Creator or space owner (route-dependent) |
| Space PRIVATE | Space-readable | Member | Yes | Creator or space owner (route-dependent) |
| Space PRIVATE | Space-readable | Non-member | No | No |

## Change Checklist

When changing permissions, update all five layers:
1. `src/domain/policy/access.ts` (pure rule if needed)
2. `src/domain/policy/resolvers.ts` (context fields if needed)
3. API helpers and route handlers
4. Page guards (`notFound`/`redirect`) for server-rendered pages
5. UI affordances (buttons, tabs, share text)

And add/update tests in:
- `test/unit/app/*access*.test.ts`
- `test/integration/api/*`
- Component tests for UI visibility where relevant
