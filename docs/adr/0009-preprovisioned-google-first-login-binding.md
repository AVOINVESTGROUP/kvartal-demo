# ADR 0009: Preprovisioned Google first-login binding

Date: 2026-07-28

Status: accepted

## Decision

Platform Admin remains the only place that grants platform, organisation or office access. Creating or activating an assignment preprovisions an `AppUser` by normalized email but does not authenticate that email and does not create a role during login.

On the first Firebase session for which no `AppUserExternalIdentity` exists, the APIs may bind the Firebase subject automatically only when all of the following are true:

1. Firebase reports `email_verified=true` and `firebase.sign_in_provider=google.com`.
2. The normalized verified email matches exactly one active preprovisioned `AppUser`.
3. That user already has at least one active platform role, organisation membership or office membership.
4. Neither the Firebase subject nor the candidate user is already actively bound to another identity.

The check, user-row lock, identity creation and audit event run in one serializable database transaction. The event uses `SYSTEM_SERVICE` and reason code `PREPROVISIONED_VERIFIED_GOOGLE_FIRST_LOGIN`. A race may reuse the winning binding only when the same provider/subject was bound; it never transfers an identity.

Unassigned, inactive, ambiguous, unverified, non-Google, already-bound or conflicting accounts remain denied with `IDENTITY_BINDING_REQUIRED`. Login never creates an `AppUser`, membership or role.

Manual binding/recovery remains available for conflicts, email changes, revoked identities and exceptional recovery. The legacy `AppUser.firebaseUid` value remains non-authoritative.

## Consequences

- Existing Platform Admin assignments work on their next verified Google login without a separate UID administration step.
- Future assigned users follow the same path.
- Removing/deactivating the assignment prevents access even when the external identity remains bound.
- Email is used only to prove that the authenticated Google subject corresponds to an already authorised database user; email alone never grants access.
