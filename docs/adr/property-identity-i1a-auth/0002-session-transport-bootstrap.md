# ADR: Session, private transport and first-owner bootstrap

Status: accepted for Increment 1A.

## Decision

Next.js exchanges a recently minted Firebase ID token for a revocation-aware five-day Firebase session cookie after exact Origin and `__Host-` CSRF validation. Browser Firebase persistence is memory-only except for session persistence during redirect round-trips, followed by client sign-out.

Private Cloud Run receives Google infrastructure identity in `X-Serverless-Authorization` and the Firebase session JWT in `Authorization`. Actor middleware derives all authority from active PostgreSQL records.

The first platform owner is bound by a one-time, environment-confirmed CLI guarded by protected configuration, Firebase user lookup, database role validation, a transactional advisory lock and permanent bootstrap state. No HTTP break-glass route exists.

## Deployment prerequisites

Confirm runtime ADC and Cloud Run invocation IAM, add protected retention/digest/bootstrap configuration and run the migration only through a proven non-production rehearsal followed by the approved production process.
