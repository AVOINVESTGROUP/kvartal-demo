# ADR 0008 — Admin authentication and surface access

**Status:** accepted  
**Date:** 2026-07-28

## Decision

`office@integrayachtsuae.com` is the single `platform_owner`. The account is authorised to enter Platform Admin, the shared Partner Admin and the temporary KVARTAL Admin. A platform role does not fabricate an organisation membership, but `platform_owner` may explicitly select any active organisation in Partner Admin. Every authenticated Office API request made through that global authority is audit logged.

All other users receive only the surfaces and organisation/office scopes granted by active PostgreSQL role assignments and memberships.

Each App Hosting hostname keeps its own host-only HttpOnly Firebase session cookie. “Access everywhere” means the account is authorised on every applicable surface; it does not weaken cookie isolation or create a parent-domain cookie. A normal logout ends the current surface session. Revoking every session is a separate, explicit security operation.

## Surface matrix

| Actor | Platform Admin | Partner Admin | KVARTAL Admin |
|---|---|---|---|
| `office@integrayachtsuae.com` / `platform_owner` | allowed | all active organisations, audited | allowed, KVARTAL scope |
| `platform_admin` | policy-defined platform access | only explicit organisation/office memberships | only explicit KVARTAL membership |
| organisation/office owner or admin | denied | active memberships only | allowed only for KVARTAL membership |
| viewer/broker | denied unless separately assigned | no organisation-administration surface | denied unless separately assigned |
| unknown or inactive identity | denied | denied | denied |

## Login contract

1. Firebase popup authentication uses memory-only browser persistence.
2. The same-origin BFF validates CSRF, token freshness and verified email, then creates the host-only session cookie.
3. The first protected request resolves the immutable `ActorContext` from the external-identity binding and current PostgreSQL roles.
4. A missing/invalid session returns to login; an authenticated but unauthorised actor sees an explicit access error; backend/configuration failures never masquerade as a role denial.
5. Partner organisation selection is server-validated on every request. Deployment defaults are preferences only and never grants.

## Logout contract

Clicking “Выйти” is the confirmation. It immediately performs the same-origin CSRF-protected POST, clears the current host’s Firebase, CSRF and legacy compatibility cookies, then hard-navigates to `/login`. `/logout` is a recovery route that starts the same operation automatically and provides visible retry/error controls. It must never look like an unloaded blank page.

## Acceptance criteria

- No redirect from Partner Admin to Platform Admin merely because the actor is `platform_owner`.
- The owner can select every active organisation and each Office API request is auditable.
- A read-only membership cannot become an admin tenant.
- Login, logout, expired/revoked session, denied access and backend failure have distinct observable outcomes.
- All three admin surfaces use the same cookie, CSRF, error and logout contract.
- Authenticated page failures render an application error with a correlation identifier, never the generic App Hosting server-error screen.
