# ADR 0006: Property Identity v4 Stage 4 migration, observability and release safety

Date: 2026-07-25
Status: deployed to `kvartal-dev` with registry rollout disabled

## Decision

Existing `PropertyObject` rows are registered without copying or replacing them. A migration preparation command creates an author-owned draft registration linked one-to-one to the legacy object. The assigned author supplies and verifies authoritative identifiers through the same cabinet workflow as a new registration. On `confirm-create`, the registry attaches the new identity profile to the linked legacy object, rather than creating a second object.

No synthetic identifier, fake verification, automatic author confirmation or platform approval is introduced.

## Migration preparation

The command is available as:

```text
pnpm --filter @kvartal/office-api property-identity:prepare-migration -- \
  --author-user-id <app-user-id> \
  --jurisdiction <code> \
  [--organization-id <organization-id>] \
  [--limit 100]
```

Dry-run is the default. A write additionally requires all of:

- `--apply`;
- `PROPERTY_IDENTITY_MIGRATION_ENABLED=true`;
- `PROPERTY_IDENTITY_MIGRATION_ENVIRONMENT` set explicitly;
- `--confirm-environment` exactly equal to that environment value;
- an active assigned author with write membership for every selected object.

Preparation creates only draft submissions and audit events. It does not publish, check, confirm, encrypt an invented identifier or activate rollout.

## Rollout semantics

- No rollout policy is seeded by the migration; the default remains `DISABLED`.
- `NEW_SUBMISSIONS_ONLY` applies the publication gate only to objects created at or after the effective policy activation time.
- `STRICT` applies the publication gate to all objects in scope.
- Organisation policy takes precedence over market policy, which takes precedence over global policy.
- The legacy manual and Drive-create paths are blocked only while the effective registry policy is enabled.

## Platform observability boundary

`platform-admin` now has a read-only Property Identity monitoring page backed by:

```http
GET /api/v1/platform/property-identity/monitoring
```

It is restricted to `platform_owner` and `platform_admin` actor roles and exposes status counts, recent redacted events, rollout policies and authority-policy metadata. It never exposes encrypted values, digests, raw identifiers or an ordinary approve/reject action.

The registration remains processed by its author in the existing partner cabinet.

## Verification

The disposable PostgreSQL suite proves that migration confirmation reuses the exact legacy `PropertyObject`, creates one verified identity profile and does not increase the object count. Source-contract tests prove that the platform monitoring surface is actor-authenticated, read-only and contains no registration approval operation.

No production database, Firebase, GCP, Drive, Gemini, deployment or rollout policy was changed.
