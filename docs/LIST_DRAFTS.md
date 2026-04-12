# List Draft Persistence

## Purpose

This document explains how starter-list drafts are persisted in the list editor today, and how the code is prepared for server-backed drafts.

Primary implementation:
- `src/components/templates/ListEditor.tsx`
- `src/lib/list-draft-storage.ts`
- `src/app/api/drafts/route.ts`

## Current Behavior (Active)

`ListEditor` currently uses **local-only** draft storage (`LocalListDraftStore`).

Flow:
1. Wait for device identity (`useUser`) and derive a user-scoped draft context.
2. Build deterministic scope id:
   - `list-editor:create:personal`
   - `list-editor:create:space:{spaceId}`
   - `list-editor:edit:{templateId}`
3. Try restore once per draft scope context.
4. If restored snapshot equals baseline initial state, clear it as stale.
5. If restored snapshot differs, apply it and show `Draft restored.` notice.
6. Autosave on state changes with 300ms debounce.
7. If state returns to baseline, clear the draft.
8. Clear draft after successful list save (before route transition).
9. Warn on browser unload while dirty.
10. On editor `Cancel` while dirty, show confirm:
    - Cancel action keeps draft and leaves
    - Confirm action discards draft and leaves

## Local Storage Format

Storage key:
- `tierlistplus_list_draft_v1:{userId}:{scopeId}`

Snapshot payload fields:
- `version`
- `updatedAtMs`
- `name`
- `description`
- `isPublic`
- `items[]` (normalized and re-ordered)

Validation and normalization on read:
- enforce field types and bounds
- trim and normalize labels/URLs/notes
- drop invalid items
- recompute `sortOrder` sequentially
- remove malformed/stale entries from local storage on read

TTL:
- drafts older than **7 days** are treated as expired and removed on read.

## Server-Backed Readiness (Implemented, Not Yet Wired in UI)

### Data model
- Prisma enum: `DraftKind` (`LIST_EDITOR`)
- Prisma model: `Draft`
  - `userId`, `deviceId`, `kind`, `scope`, `payload`, timestamps
  - unique key: `(userId, kind, scope)`

### API
- `GET /api/drafts?kind=...&scope=...`
- `PUT /api/drafts` with `{ kind, scope, payload }`
- `DELETE /api/drafts?kind=...&scope=...`

Server-side guardrails:
- authenticated user only
- `LIST_EDITOR` payload schema validation (versioned shape)
- max `500` items per list-editor draft payload
- max payload size `256KB` (JSON-encoded)

### Client stores
- `RemoteListDraftStore` (API-backed)
- `HybridListDraftStore` (local + remote, newest `updatedAtMs` wins)

`ListEditor` is intentionally still local-first for now to avoid unexpected network write behavior until sync policy is finalized.

## Recommended Sync Guardrails Before Enabling Hybrid in UI

When switching `ListEditor` to hybrid mode:
1. Keep local autosave immediate.
2. Gate remote writes while tab is hidden (`document.visibilityState !== "visible"`).
3. Throttle remote sync (for example every 10-15 seconds max).
4. Flush queued latest snapshot when tab becomes visible or network returns.
5. Skip remote write when payload is unchanged.
6. Retry remote writes with backoff and keep local state authoritative.
