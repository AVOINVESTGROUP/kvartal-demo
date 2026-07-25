# Auth Foundation incident resolution

Date: 2026-07-25

Environment: `kvartal-dev`

Status: resolved and verified end to end.

## Permanent changes

- Granted `roles/firebaseauth.viewer` to the actual runtime identities:
  - `kvartal-office-api@kvartal-dev.iam.gserviceaccount.com`;
  - `kvartal-platform-api@kvartal-dev.iam.gserviceaccount.com`.
- The role is read-only and supplies `firebaseauth.users.get`, which is required by revoked-session verification. No Firebase user mutation role was granted.
- Completed the one-time `FIREBASE_PLATFORM_OWNER_BOOTSTRAP` for the existing active `platform_owner` user `abtiurin@gmail.com`.
- The resulting Firebase external identity is `ACTIVE` and is connected to the existing application user that already owns two organizations and one office membership.
- The bootstrap state is `COMPLETED` and references a `BOOTSTRAP_COMPLETED` audit event.

## Verification

- Cloud Run readiness checks with authenticated invocation:
  - `kvartal-office-api /readyz` returned `200`, `database=ready`;
  - `kvartal-platform-api /readyz` returned `200`, `database=ready`.
- All three hosted login pages returned `200` and retained `Cross-Origin-Opener-Policy: same-origin-allow-popups`:
  - `partner-admin-dev`;
  - `kvartal-admin-dev`;
  - `fixer-platform-admin-dev`.
- A synthetic Firebase sign-in for the bootstrapped user created a real short-lived Firebase session cookie and called both currently serving APIs through Cloud Run IAM.
- The end-to-end result was confirmed twice:
  - office `/api/v1/admin/actor-context`: `200`;
  - platform `/api/v1/platform/actor-context`: `200`;
  - platform roles: `platform_owner`;
  - organization memberships: 2;
  - office memberships: 1;
  - no structured auth error was returned.

## Cleanup and retained safeguards

- Deleted both temporary Cloud Run verification/bootstrap jobs.
- Removed the temporary `roles/iam.serviceAccountTokenCreator` binding used only for the synthetic sign-in.
- Removed temporary operator Firebase Auth Viewer access after each diagnostic window.
- Both versions of the one-time `platform-owner-bootstrap-secret` are disabled; the first version was never attached or used.
- The temporary secret-level accessor binding was removed.
- The local Cloud SQL Auth Proxy was stopped.
- No frontend or API code was changed or deployed, no traffic was switched, and no database migration was reversed.
- The successful Stage 0 insurance backup `1785001724586` remains available.

## User verification

Open any of the three dev admin URLs, refresh the page, and sign in as `abtiurin@gmail.com`. Existing valid sessions can start working after refresh; if the browser retained a failed login state, use the Google login button once to create a fresh session.
