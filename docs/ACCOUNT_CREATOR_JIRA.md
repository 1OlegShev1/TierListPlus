# Account and Creator Jira Map

This file records the Jira structure created for the account and creator roadmap.

Project:
- `KAN` / Tierlsitplus

Jira is being used as a lightweight solo-dev backlog. Epics are broad parking buckets. Day-to-day
work should happen from concrete stories/tasks, not from inventing more hierarchy.

## Created Epics

- `KAN-4` Persistent Account Foundation
- `KAN-5` Account Surface
- `KAN-6` Creator Space Foundation
- `KAN-7` Analytics Foundation
- `KAN-8` Entitlements and Billing Foundation

## Next In Line

These are the practical next tickets. They all sit under `KAN-4`.

1. `KAN-9` Add optional email persistence data model
2. `KAN-10` Implement email recovery request endpoint
3. `KAN-11` Implement email verification consume endpoint
4. `KAN-12` Add Resend-backed sendEmail implementation
5. `KAN-13` Add auth cleanup and audit events

Recommended implementation order:

1. `KAN-9`
2. `KAN-12`
3. `KAN-10`
4. `KAN-11`
5. `KAN-13`

Reasoning:
- The schema has to exist before endpoints can use it.
- Email delivery can be stubbed early so endpoint tests do not depend on a real provider.
- Request and consume endpoints should be built as one coherent auth loop.
- Audit/cleanup is useful hardening, but not required for the first working loop.

## Epic Intent

### `KAN-4` Persistent Account Foundation

Purpose:
- Make anonymous accounts recoverable without forcing signup.

Contains:
- optional verified email
- verification tokens
- magic link and OTP flow
- attach-or-merge account behavior
- auth-sensitive cleanup and audit events

Does not contain:
- passwords
- OAuth/passkeys
- billing
- creator dashboard UX

### `KAN-5` Account Surface

Purpose:
- Show users whether their work is recoverable and let them manage recovery/devices.

Likely future tickets:
- Add non-blocking "Save your workspace" prompt.
- Show anonymous/saved account state.
- Add account recovery section on the devices page.
- Add linked browser revoke flow.

### `KAN-6` Creator Space Foundation

Purpose:
- Make `Space` the creator/community boundary for future paid and branded features.

Likely future tickets:
- Add creator-ready fields to `Space`.
- Add optional unique space slug.
- Require verified email before claiming a public slug.
- Decide whether `CreatorProfile` is needed or whether `Space` is enough.

### `KAN-7` Analytics Foundation

Purpose:
- Collect useful aggregate metrics for creators without invasive voter tracking.

Likely future tickets:
- Add analytics event model.
- Add daily rollup model.
- Capture core funnel events.
- Build first private creator analytics view.
- Add CSV export later.

### `KAN-8` Entitlements and Billing Foundation

Purpose:
- Prepare paid creator features without wiring product code directly to Stripe.

Likely future tickets:
- Add local space entitlement model.
- Add entitlement helper functions.
- Add Stripe Checkout.
- Add Stripe Customer Portal.
- Add webhook-driven subscription state.

## Working Rules

- Do not create more epics unless one of the current buckets becomes hard to use.
- Future monetization ideas start as stories/tasks under existing epics.
- Keep tickets implementation-sized enough that one person can finish and verify them.
- Do not gate basic voting, joining, or simple ranking creation behind paid/account features.
- Persistent account work comes before creator analytics, branding, or billing.

