# ADR 0003: Property Identity v4 Stage 1 registry foundation

Date: 2026-07-25
Status: completed locally; rollout remains disabled; no deployment performed

## Result

Stage 1 adds the self-service Property Identity registry foundation to the existing `office-api` and PostgreSQL SSOT. It does not create a separate partner portal and does not introduce routine platform review.

The submission author can now:

1. create a registration submission;
2. retain incomplete or unrecognised identifier observations for correction;
3. replace identity input and identifiers with optimistic concurrency (`If-Match`) and mutation idempotency;
4. run an exact authoritative-identifier check;
5. confirm `CREATE_NEW` after the latest `UNIQUE_CANDIDATE` result;
6. confirm `LINK_EXISTING` after the latest `EXACT_EXISTING` result.

The author is the only ordinary actor allowed to list, read, edit, check or confirm that submission. Organisation and office scope always comes from `ActorContext`.

## API surface

All routes require `ACTOR_AUTH_REQUIRED`:

- `POST /api/v1/admin/property-identity/submissions`;
- `GET /api/v1/admin/property-identity/submissions`;
- `GET /api/v1/admin/property-identity/submissions/:id`;
- `PATCH /api/v1/admin/property-identity/submissions/:id`;
- `POST /api/v1/admin/property-identity/submissions/:id/check`;
- `POST /api/v1/admin/property-identity/submissions/:id/confirm-create`;
- `POST /api/v1/admin/property-identity/submissions/:id/confirm-link`.

Mutation requests require `Idempotency-Key`. `PATCH` also requires a quoted current `If-Match` row version and returns an `ETag`.

## Concurrency and identity guarantees

- Identity-check hashes cover physical identity input and the complete sorted identifier-observation/digest set.
- Confirmation accepts only the latest resolved check run with the unchanged identity hash.
- Finalisation runs in a serializable transaction with bounded retries.
- PostgreSQL advisory locks are acquired in deterministic digest order.
- Active digest aliases have a partial unique database index.
- Concurrent finalisations for the same authoritative identifier can create only one canonical identity.
- A canonical profile has exactly one current canonical version.

## Identifier confidentiality and key rotation

- Raw and normalised identifier values use AES-256-GCM with authenticated context.
- Every observation and accepted claim stores its encryption-key version.
- Cross-record comparison uses keyed HMAC-SHA-256 digests; plaintext identifier indexes do not exist.
- Active and retiring digest-key versions are written together for rotation-safe lookup.
- API responses never return ciphertext, digests or raw identifier values.
- Exact-match responses expose only a redacted existence result to the author.

Required runtime secret/configuration names are:

- `PROPERTY_IDENTITY_ENCRYPTION_KEY_BASE64`;
- `PROPERTY_IDENTITY_ENCRYPTION_KEY_VERSION`;
- `PROPERTY_IDENTITY_DIGEST_KEYS_JSON`.

Values must come from the approved secret-management path and must never be committed. The configured encryption version and every active/retiring digest version must exist in `PropertyIdentityCryptoKeyVersion`.

The foundation migration registers the initial `v1` metadata row only. It contains no key material and does not enable registry rollout; the matching encryption and digest keys must be provisioned independently in Secret Manager before the API is deployed.

## Authority and rollout policy

Authority rules are selected deterministically by organisation, market, asset class and policy version. A rule may use an exact namespace or a trailing-wildcard namespace. Rules that do not permit automatic exact matching are retained as correction-required observations rather than silently accepted.

Rollout resolution is:

1. organisation policy;
2. market policy;
3. global policy;
4. implicit disabled state when no active policy exists.

No rollout rows are seeded by this change. Therefore registry creation and all legacy-path gates remain off until an authorised later rollout explicitly activates them.

When registry rollout is active:

- legacy manual object creation is blocked and must use a registration submission;
- Drive intake cannot create a new object outside a submission;
- publication can require a verified identity profile with one current canonical version.

Drive updates to an already existing object remain possible; publication is still subject to the publish gate.

## Verification

The disposable PostgreSQL 16 integration suite proves:

- migration deployment from an empty database;
- active digest uniqueness under concurrent writes;
- advisory-lock finalisation creates only one canonical identity under a race;
- author-owned create/check/confirm-create flow;
- encrypted persistence of incomplete observations;
- correction with row-version control;
- exact-existing check and confirm-link flow;
- cross-author access rejection;
- one current canonical version;
- AES-GCM shape and rollout-scope constraints.

Unit tests cover state transitions, canonicalisation, normalisation, cryptography, author-confirmation eligibility, tenant scope, authority selection and rollout selection.

## Non-actions and next integration boundary

This stage made no production database, IAM, Firebase, deployment, blockchain or external-system write. It did not modify the dirty main worktree.

The next stage is UI integration inside the existing `partner-admin` and `kvartal-admin` object workflows. The registry must remain disabled until those clients, approved authority-policy data, secret versions and an authorised deployment procedure are ready.
