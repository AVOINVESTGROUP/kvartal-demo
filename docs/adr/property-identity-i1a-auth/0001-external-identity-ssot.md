# ADR: Firebase external identity SSOT

Status: accepted for Increment 1A.

## Decision

`AppUserExternalIdentity(provider=FIREBASE, subject=<Firebase UID>)` is the only authentication lookup for new secure middleware. `AppUser.firebaseUid` is deprecated for authentication and remains a non-authoritative compatibility field until legacy consumers are mapped.

Provider/subject is lifetime unique. A user may have one active Firebase identity. Revocation preserves ownership; reactivation is possible only to the same user through a separately reviewed request. Cross-user transfer is outside the normal API.

## Consequences

Verified email can suggest a candidate but never authenticates or binds a user. Binding mutations are owner-only, audited, idempotent and concurrency controlled. Synthetic legacy values are safe because middleware never reads them.
