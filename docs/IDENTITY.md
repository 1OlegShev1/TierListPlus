# TierList+ Identity Model

## Invariants

1. A signed HTTP-only cookie is the authority for an active browser session.
2. `tierlistplus_identity` in local storage is a continuity hint, not a credential.
3. Losing a cookie must not silently create another user when local storage remembers an identity.
4. A fresh user is created only for a browser with no remembered identity or after an explicit
   "start fresh" confirmation.
5. A valid one-time link code is sufficient to attach a browser directly to its target user.
6. Account merges preserve all owned data and the higher platform role.
7. Identity creation, direct device linking, and account merges leave an append-only audit event.

## Browser Bootstrap

The client checks `GET /api/users/session` before doing anything with its local hint.

| Session result | Remembered identity | Outcome |
| --- | --- | --- |
| Valid | Any | Use the cookie identity and synchronize local storage |
| Missing/invalid/revoked | Present | Enter recovery-required state; never auto-create |
| Missing/invalid/revoked | Absent | Create a first-visit anonymous user and device |

The session endpoint returns a structured failure code:

- `SESSION_COOKIE_MISSING`
- `SESSION_TOKEN_INVALID`
- `SESSION_DEVICE_NOT_FOUND`
- `SESSION_DEVICE_REVOKED`

## Recovery

A linked browser generates a short-lived one-time code. The recovering browser may redeem that
code with or without an existing valid session:

- With a valid session belonging to another user, the existing account merge path runs.
- Without a valid session, a new `Device` is created directly on the code owner. No temporary user
  is created.
- With a valid session already belonging to the code owner, the current device is renamed and the
  code is consumed.

Every successful path reissues the HTTP-only session cookie.

## Explicit Fresh Start

When recovery is required, the user can explicitly choose an empty workspace. The UI warns that
this creates a separate anonymous account and requires confirmation. This is the only replacement
for the old silent-fork behavior.

## Merge Rules

`mergeAccountIntoTarget` keeps the link-code owner as the surviving user, moves resources and
devices, resolves duplicate memberships/participants/drafts, and preserves:

- the higher of `USER`, `MODERATOR`, and `ADMIN`;
- the target nickname, falling back to the source nickname when the target has none.

The source user is deleted only after the merge transaction has completed its transfers and audit
event.

## Audit Trail

`IdentityEvent` stores operational events without foreign keys so records survive account deletion.
Current event types are:

- `USER_CREATED`
- `DEVICE_LINKED`
- `ACCOUNT_MERGED`

The trail stores IDs and small reason/metadata fields, never session tokens or recovery codes.

## Remaining Durable-Account Work

Anonymous browser identity remains intentionally lightweight. Optional verified email recovery is
still the next durable-account layer. It should reuse direct device linking and the existing merge
transaction rather than introducing a second ownership model.

## Incident History

- [2026-07-19 identity fork incident](IDENTITY_INCIDENT_2026-07-19.md)
