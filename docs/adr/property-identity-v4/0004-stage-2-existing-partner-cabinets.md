# ADR 0004: Property Identity v4 Stage 2 in existing partner cabinets

Date: 2026-07-25
Status: superseded in part by ADR 0007

> The separate `/property-identity` partner route described below was rejected by the product owner on 2026-07-26. Property Identity must be embedded in the existing object workflow. See ADR 0007.

## Decision

The Property Identity self-service workflow is embedded in the two existing partner cabinets:

- the universal multi-tenant `partner-admin`;
- the dedicated KVARTAL Moscow `kvartal-admin`.

No new cabinet and no parallel Property Identity portal were created. `platform-admin` is not part of the ordinary registration workflow.

Both cabinets expose `/property-identity` from their existing object-management navigation. The dedicated KVARTAL route uses the same tested registry screen as the universal partner cabinet, so the product rules and error handling cannot drift between the two interfaces.

## User workflow

The authenticated author can:

1. see only their own office-scoped submissions;
2. create a submission with physical object data and up to the supported identifier payload;
3. see whether an identifier is ready or requires correction without seeing encrypted/raw server data;
4. replace an identifier under `If-Match` row-version control;
5. run duplicate checking;
6. confirm creation only for `UNIQUE_CANDIDATE`;
7. confirm linking only for `EXACT_EXISTING`;
8. cancel an unfinished submission without deleting its audit history;
9. see the canonical `PropertyObject` reference after completion.

The interface explains in plain language that the author processes the application and that the platform does not review ordinary submissions.

## Secure transport

Registry calls use the actor-aware BFF transport:

- Cloud Run infrastructure identity in `X-Serverless-Authorization`;
- Firebase session JWT in `Authorization`;
- tenant and user identity derived from backend `ActorContext`.

The legacy admin write token is not used by registry routes.

The dedicated `kvartal-admin` login was upgraded to the same foundation already used by `partner-admin`:

- strict `__Host-` CSRF cookie and origin validation;
- recent Firebase login enforcement;
- HttpOnly strict Firebase session cookie;
- in-memory popup persistence and session-only redirect fallback;
- Firebase client sign-out after exchange;
- POST-only CSRF-protected logout;
- database-derived `ActorContext` before cabinet access.

## Rollout behaviour

The registry context endpoint returns only writable office scopes, active markets, effective rollout state and applicable public authority-policy metadata. The create form is unavailable when no accessible market has registry rollout enabled.

The old object UI remains operational while rollout is disabled. When rollout is enabled, backend gates prevent the old manual and Drive-create paths from bypassing the registry, and the cabinet provides the registry workflow required to proceed.

## Verification

- `partner-admin` production build includes `/property-identity`.
- `kvartal-admin` production build includes secure auth routes, POST logout and `/property-identity`.
- browser/auth source-contract tests now cover all three secure admin apps, including `kvartal-admin`.
- office API and disposable PostgreSQL integration tests cover create, correction, checking, create/link confirmation, author isolation and cancellation.

No Firebase, IAM, App Hosting, Cloud Run or production database change was made.
