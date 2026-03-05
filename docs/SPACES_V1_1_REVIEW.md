# Spaces V1.1 Review Guide

Use this order to keep review context small and deterministic.

## 1) Data model and invariants

Review files:
- `prisma/schema.prisma`
- `prisma/migrations/20260305100000_add_spaces/migration.sql`
- `prisma/migrations/20260305113000_enforce_space_resource_invariants/migration.sql`
- `src/lib/validators.ts`
- `src/lib/nanoid.ts`
- `src/lib/template-access.ts`
- `src/lib/home-data.ts`
- `src/types/index.ts`

Check:
- Space entities and relations are correct
- space-scoped resources cannot leak into personal/public feeds
- DB constraints match API expectations

## 2) Authorization policy and domain services

Review files:
- `src/domain/policy/access.ts`
- `src/domain/policy/resolvers.ts`
- `src/domain/spaces/service.ts`
- `src/domain/sessions/service.ts`
- `src/domain/templates/service.ts`
- `src/lib/api-helpers.ts`

Check:
- all access decisions are centralized and consistent
- `creator OR space owner` mutation rule is applied consistently
- private/open visibility behavior matches spec

## 3) API routes

Review files:
- `src/app/api/spaces/**`
- `src/app/api/sessions/route.ts`
- `src/app/api/sessions/join/route.ts`
- `src/app/api/sessions/[sessionId]/route.ts`
- `src/app/api/sessions/[sessionId]/template/route.ts`
- `src/app/api/templates/route.ts`
- `src/app/api/templates/[templateId]/route.ts`
- `src/app/api/templates/[templateId]/duplicate/route.ts`
- `src/app/api/templates/[templateId]/items/route.ts`
- `src/app/api/templates/[templateId]/items/[itemId]/route.ts`

Check:
- route handlers are thin and delegate to domain services when appropriate
- behavior of existing personal/public APIs remains unchanged
- space discovery remains under `/spaces`

## 4) UI and integration points

Review files:
- `src/app/spaces/page.tsx`
- `src/app/spaces/[spaceId]/page.tsx`
- `src/components/spaces/*`
- `src/components/layout/NavBar.tsx`
- `src/app/templates/*`
- `src/app/sessions/*`
- `src/components/templates/*`
- `src/components/sessions/*`
- `src/lib/space.ts`
- `src/lib/account-linking.ts`

Check:
- open/private UX paths are clear
- non-space pages still focus on personal/public content
- membership and invite flows are understandable

## 5) Regression tests

Review files:
- `test/integration/api/sessions-collection.test.ts`
- `test/integration/api/templates.test.ts`
- `test/unit/components/NewVoteForm.test.tsx`
- `test/unit/lib/misc-lib.test.ts`

Validation commands:
- `npm run lint`
- `npx tsc --noEmit --incremental false`
- `npm test`
