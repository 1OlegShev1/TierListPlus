# Admin, Moderation, and Stats Status

## Goal

Add lightweight but real RBAC for internal operations while keeping default user behavior unchanged.

## What Is Implemented

### Roles

- `User.role` is implemented in Prisma as `USER | MODERATOR | ADMIN`.
- Existing users are backfilled safely through DB defaults (`USER`).
- New browser-provisioned users remain `USER`.

Key files:
- `prisma/schema.prisma`
- `prisma/migrations/20260311121000_add_user_roles/migration.sql`
- `src/lib/auth.ts`
- `src/lib/api-helpers.ts` (`requireRole`, `requireModerator`, `requireAdmin`)

### Moderation Model

Template/session moderation metadata is implemented:
- `isModeratedHidden`
- `moderatedByUserId`
- `moderationReason`
- `moderatedAt`

Key files:
- `prisma/schema.prisma`
- `prisma/migrations/20260311124500_add_template_session_moderation_fields/migration.sql`

### Admin/Moderator APIs

- `GET /api/admin/stats` (admin-only)
- `GET /api/admin/public-content` (moderator/admin)
- `PATCH /api/admin/templates/:templateId/moderation` (moderator/admin)
- `PATCH /api/admin/sessions/:sessionId/moderation` (moderator/admin)

Key files:
- `src/app/api/admin/stats/route.ts`
- `src/app/api/admin/public-content/route.ts`
- `src/app/api/admin/templates/[templateId]/moderation/route.ts`
- `src/app/api/admin/sessions/[sessionId]/moderation/route.ts`

### Admin UI

- `/admin` page is admin-only.
- Nav shows `Admin` link only for admins.

Key files:
- `src/app/admin/page.tsx`
- `src/components/admin/AdminStatsPage.tsx`
- `src/components/layout/NavBar.tsx`

## Current Moderation Visibility Rules

### Public browsing

Moderated-hidden public content is excluded from regular public browsing surfaces.

### Session access

For moderated-hidden sessions:
- outsiders are denied (`404`) on join/session pages
- owners and existing participants keep access

Join flow is fail-closed for non-participants, including join-code handling.

### Admin stats buckets

Stats now separate:
- publicly available
- moderated

for both templates and sessions.

## Backward Compatibility and Migration

- Role column default keeps old users compatible.
- No manual data migration required for existing rows beyond running migrations.
- Existing session cookies continue to work.

Operational order:
1. Deploy migration image.
2. Run migrations.
3. Start updated app image.

## Local Admin Role Management

CLI:

```bash
npm run admin:role -- --list --limit 20
npm run admin:role -- --user <user-id> --role ADMIN
```

Files:
- `scripts/admin-role.ts`
- `package.json` (`admin:role`)

## Open Items (Not Implemented Yet)

1. Audit log persistence for admin/moderation actions.
2. Break-glass private-content troubleshooting flow with explicit reason + audit trail.
3. Optional pre-aggregated daily stats snapshots if live counts become expensive.
