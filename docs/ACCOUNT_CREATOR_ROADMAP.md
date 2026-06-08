# Account and Creator Roadmap

## Purpose

TierList+ should stay anonymous-first, but future creator features need durable ownership. This
roadmap describes how to add persistent accounts without turning the product into a signup-wall app,
then use that identity foundation for creator spaces, analytics, branding, and eventually paid
plans.

The product line is:

> No signup to rank. Add email when you want to keep, brand, or grow your rankings.

## Current Baseline

Identity today:
- First visit creates a `User` and `Device`.
- A signed httpOnly cookie points to the active `Device`.
- Data ownership hangs off `User`.
- `Device` rows can be linked/revoked.
- `LinkCode` recovery can merge one anonymous account into another.
- `mergeAccountIntoTarget` now preserves drafts and resolves duplicate draft scopes.
- `SESSION_SECRET_PREVIOUS` allows safe secret rotation.

Important product constraint:
- Anonymous creation and voting are a competitive advantage.
- Persistent accounts must be optional and presented as recovery/saving, not as mandatory signup.

## Jira Tracking

Jira project:
- `KAN` / Tierlsitplus

This is a solo-dev project, so Jira should stay lightweight. Use epics as parking buckets for
durable product tracks, not as heavy program-management process.

Created epics:
- `KAN-4` Persistent Account Foundation
- `KAN-5` Account Surface
- `KAN-6` Creator Space Foundation
- `KAN-7` Analytics Foundation
- `KAN-8` Entitlements and Billing Foundation

Immediate next tickets under `KAN-4`:
- `KAN-9` Add optional email persistence data model
- `KAN-10` Implement email recovery request endpoint
- `KAN-11` Implement email verification consume endpoint
- `KAN-12` Add Resend-backed sendEmail implementation
- `KAN-13` Add auth cleanup and audit events

Working rule:
- Pick from `KAN-9` through `KAN-13` first.
- Do not create more epics unless a bucket becomes too noisy to use.
- Future monetization ideas can start as stories/tasks under the existing epics.

## Strategic Model

The identity ladder:

```text
Anonymous user
  -> saved account
  -> creator/space owner
  -> paid creator space
```

The data ownership ladder:

```text
User
  owns Devices
  owns Spaces
  has optional verified email
  may later own billing relationships

Space
  is the creator/community boundary
  owns templates and rankings
  later owns branding, analytics, limits, and plan state

Template / Session
  remain content objects
  feed analytics and creator workflows
```

## Principles

1. Anonymous-first remains default.
2. Verified email means durable account.
3. The existing `User.id` remains the app ownership root.
4. The current httpOnly device cookie remains the session mechanism.
5. No bearer credentials go into `localStorage`.
6. Account linking reuses the existing merge path.
7. Paid features attach primarily to `Space`, not to individual one-off votes.
8. Billing should update local entitlements; product code should not depend directly on Stripe.
9. Analytics should be aggregate-first and privacy-conscious.

## Non-Goals For The Near Term

- No forced signup before voting or creating.
- No passwords.
- No OAuth/passkeys until there is a clear product reason.
- No full auth-framework migration unless the auth surface expands substantially.
- No billing UI built from scratch.
- No invasive voter tracking for analytics.

## Stage 0: Identity Hardening Already Done

Status: done.

Shipped hardening:
- Draft preservation during account merge.
- Session secret rotation support.
- Cryptographic recovery-code randomness.
- Per-device recovery redemption rate limiting.

Remaining possible hardening:
- DB-backed rate limits for auth-sensitive flows instead of process-local memory limits.
- Audit events for account merge, email link, device revoke, and suspicious throttling.
- Cleanup job for expired verification tokens and old link codes.

## Stage 1: Optional Email Persistence

Goal:
- A user can save their anonymous account with email and recover it on another browser/device.

User-facing language:
- "Save your workspace"
- "Add email recovery"
- "Keep your rankings across browsers"

Avoid:
- "Create account" as the main call to action.
- blocking modals before core flows.
- implying email is required to vote.

### Data Model Draft

Minimal `User` extension:

```prisma
model User {
  id              String    @id @default(cuid())
  email           String?   @unique
  emailVerifiedAt DateTime?
  // existing fields...
}
```

Implementation notes:
- Store email normalized for lookup. Lowercase and trim.
- If display-preserving email is desired later, split into `email` and `emailNormalized`.
- Unique nullable email is enough for one email per account.

Verification token:

```prisma
enum VerificationTokenPurpose {
  EMAIL_LOGIN
}

model VerificationToken {
  id           String                   @id @default(cuid())
  purpose      VerificationTokenPurpose
  email        String
  tokenHash    String
  otpHash      String?
  deviceId     String?
  expiresAt    DateTime
  consumedAt   DateTime?
  attemptCount Int                      @default(0)
  createdAt    DateTime                 @default(now())

  @@index([email, purpose, createdAt])
  @@index([expiresAt])
  @@unique([tokenHash])
}
```

Token policy:
- High-entropy random magic-link token.
- 6-digit OTP for cross-device flow.
- Store hashes only.
- Short TTL, likely 10-15 minutes.
- Single-use by atomic consume.
- Generic responses to avoid email enumeration.

### API Draft

Request email link:

```text
POST /api/account/email/request
body: { email: string }
response: { ok: true }
```

Rules:
- Requires current device identity.
- Always return generic success.
- Rate-limit by device, normalized email, and best-effort client key.
- Email contains a magic link and OTP.

Verify:

```text
POST /api/account/email/verify
body: { token?: string, otp?: string, email?: string, deviceName?: string }
response: { userId: string, deviceId: string, email: string }
```

Rules:
- Requires current device identity.
- Consume token/OTP atomically.
- If email is unused, attach it to current `User`.
- If email already belongs to another `User`, merge current account into the email owner.
- Reissue the session cookie for the surviving device.
- Do not expose whether an email exists before successful verification.

### Email Delivery Draft

`sendEmail()` interface:

```ts
interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void>;
```

Provider:
- Use Resend initially.
- Keep provider behind the interface for future replacement.
- Production domain must have SPF, DKIM, and DMARC configured.

### Tests

Core tests:
- request endpoint returns generic success for new and existing email.
- token hashes are stored, raw token is not.
- expired/consumed token fails.
- verify unused email attaches to current user.
- verify existing email merges accounts.
- duplicate verify is safe.
- rate limits return `429`.
- session cookie is refreshed after attach/merge.

## Stage 2: Account Surface

Goal:
- Users understand whether their work is recoverable.

Possible surfaces:
- Devices page: "Account recovery" section.
- Home page after meaningful activity: subtle "Save your workspace" prompt.
- Template/session save flows: non-blocking reminder after first created item.

State labels:
- Anonymous
- Saved with email
- Linked browsers

Actions:
- Add email recovery.
- Resend verification.
- Link another browser.
- Revoke browser.

Do not build in v1:
- Change email.
- Delete account.
- OAuth.
- Passwords.

Those can come after the first persistent-account loop works.

## Stage 3: Creator Boundary

Goal:
- Establish the durable object that future creator features attach to.

Recommendation:
- Use `Space` as the creator/community container.
- Do not scatter paid state across templates and sessions.

Likely `Space` evolution:

```prisma
model Space {
  id          String  @id @default(cuid())
  creatorId   String
  slug        String? @unique
  name        String
  description String?
  logoUrl     String?
  accentColor SpaceAccentColor
  // future:
  // plan
  // billingOwnerUserId
  // branding settings
}
```

Creator requirements:
- Verified email required to claim a public slug.
- Verified email required to enable analytics or paid features.
- Space owner remains the permission root for creator controls.

Possible "creator profile" split:
- Start with `Space` unless a separate public profile becomes necessary.
- Add `CreatorProfile` later only if one user needs multiple independent public identities, or if
  profile data stops fitting the space model.

## Stage 4: Analytics Foundation

Goal:
- Collect useful aggregate creator metrics without invasive tracking.

Event candidates:
- space viewed
- template viewed
- template duplicated/used
- ranking viewed
- join started
- join completed
- vote submitted
- results viewed
- share link opened

Event shape draft:

```prisma
model AnalyticsEvent {
  id         String   @id @default(cuid())
  type       String
  userId     String?
  deviceId   String?
  spaceId    String?
  templateId String?
  sessionId  String?
  createdAt  DateTime @default(now())

  @@index([spaceId, createdAt])
  @@index([templateId, createdAt])
  @@index([sessionId, createdAt])
}
```

Rollup shape draft:

```prisma
model AnalyticsDailyRollup {
  id         String   @id @default(cuid())
  day        DateTime
  spaceId    String?
  templateId String?
  sessionId  String?
  metric     String
  value      Int

  @@unique([day, spaceId, templateId, sessionId, metric])
}
```

Retention:
- Raw events short-lived.
- Rollups retained longer.
- Paid plans can unlock longer retention and export.

Privacy:
- Creator dashboards should favor aggregates.
- Avoid exposing individual voter identity unless the voter intentionally joined with visible profile
  information later.

## Stage 5: Entitlements Before Billing

Goal:
- Product logic can ask "can this user/space use this feature?" without caring how payment works.

Plan/entitlement draft:

```prisma
enum PlanCode {
  FREE
  CREATOR
  PRO
}

model SpaceEntitlement {
  id        String   @id @default(cuid())
  spaceId   String   @unique
  plan      PlanCode @default(FREE)
  updatedAt DateTime @updatedAt
}
```

Helper examples:

```ts
canUseBranding(userId, spaceId)
canViewAnalytics(userId, spaceId)
canExportAnalytics(userId, spaceId)
getSpaceLimits(spaceId)
```

Paid gates that fit the product:
- branding controls
- custom slug
- analytics retention
- CSV export
- more templates/rankings/spaces
- larger storage limits
- larger private events

Do not gate:
- basic voting
- joining from a shared link
- creating a simple ranking

## Stage 6: Billing

Goal:
- Let creators pay without building billing operations in-house.

Recommendation:
- Use Stripe Checkout for purchase.
- Use Stripe Customer Portal for plan/payment management.
- Store local subscription state from Stripe webhooks.

Data model draft:

```prisma
model BillingCustomer {
  id               String @id @default(cuid())
  userId           String @unique
  stripeCustomerId String @unique
  createdAt        DateTime @default(now())
}

model SpaceSubscription {
  id                   String @id @default(cuid())
  spaceId               String @unique
  stripeSubscriptionId  String? @unique
  status                String
  plan                  PlanCode
  currentPeriodEnd      DateTime?
  updatedAt             DateTime @updatedAt
}
```

Webhook handling:
- Verify Stripe signatures.
- Update local subscription status.
- Product reads only local entitlements.
- Failed webhooks should be retry-safe and idempotent.

## Suggested Sequence

1. Optional email persistence.
2. Minimal account surface.
3. Space slug and creator-ready space profile fields.
4. Analytics event capture and rollups.
5. Internal entitlement helpers.
6. Free creator analytics dashboard.
7. Branding controls behind entitlement checks.
8. Stripe billing and customer portal.
9. Paid retention/export/limits.

## Open Decisions

- Store only normalized email, or both display email and normalized email?
- OTP verification shape: token-only, OTP-only, or token plus OTP fallback?
- Verification token TTL: 10 or 15 minutes?
- Should server-backed drafts be enabled before email auth, or after persistent accounts exist?
- Should analytics raw events include `deviceId`, or only aggregate keys?
- Is a separate `CreatorProfile` needed, or can `Space` carry the public creator identity?
- Should paid plans attach to user or space? Current recommendation: space.

## External References

- Better Auth remains worth reconsidering if OAuth, passkeys, teams, or broader auth methods become
  product priorities: https://better-auth.com/docs/plugins
- OWASP forgot-password guidance is relevant to email magic links and OTP flows:
  https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- Resend domain authentication should be configured before production email:
  https://resend.com/docs/dashboard/domains/dmarc
- Stripe Customer Portal is the likely future billing-management surface:
  https://docs.stripe.com/billing/subscriptions/integrating-customer-portal
