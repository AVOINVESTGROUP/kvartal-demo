# ADR 0001: Self-service lifecycle for Property Identity registration

Date: 2026-07-25
Status: accepted by product owner
Scope: IREPN Property Identity Registry in KVARTAL

## Context

Earlier Property Identity plans and Prompt 06B required a platform employee to review and approve every partner registration submission. The product owner corrected that assumption on 2026-07-25: a submission is processed by the same partner-side actor who creates it.

The current architecture already provides:

- `apps/partner-admin` as the universal multi-tenant partner console;
- `apps/kvartal-admin` as the dedicated KVARTAL Moscow partner console;
- `apps/office-api` as the current authenticated partner operations backend;
- `apps/platform-admin` and `apps/platform-api` as the Fixer.guru owner administration layer.

## Decision

Normal Property Identity registration is a partner self-service workflow.

The authenticated submission author:

1. creates and edits the registration submission;
2. supplies structured identifiers and evidence;
3. starts deterministic and asynchronous duplicate checks;
4. corrects insufficient or contradictory data;
5. confirms `CREATE_NEW` only for the latest successful `UNIQUE_CANDIDATE` run;
6. confirms `LINK_EXISTING` only for the latest successful `EXACT_EXISTING` run.

The registry engine, database constraints and publication gate determine technical eligibility. `apps/platform-admin` does not approve, reject or close normal submissions, and `apps/platform-api` must not expose a normal-submission approve/reject endpoint.

An exact authoritative identifier conflict cannot be overridden by the submitter. Irreconcilable disputes, legacy merge/split, wallet recovery and emergency contract controls are separate exceptional procedures; they are not states in the ordinary submission approval chain.

## Security consequences

- Organisation and office come only from verified `ActorContext`, never from body authority.
- The author can act only within active organisation/office membership and the relevant object-write permission.
- Exact-match responses are redacted across tenants.
- Confirm commands are bound to the latest successful check run and invalidated by identity-field changes.
- Database uniqueness and serializable finalisation prevent concurrent duplicate canonical objects.
- Linking an existing physical property does not grant access to another organisation's evidence, offer or confidential fields.

## Domain consequences

- Replace reviewer approval with an audited `PropertyIdentityAuthorConfirmation`.
- Separate canonical physical identity from organisation-specific `PropertyRepresentationRight`, `PartnerOffer` and `PropertyPublicationGrant`.
- Keep `PropertyObject` as the canonical physical property record.
- Preserve exceptional dispute administration outside the normal registration lifecycle.

## UI and API placement

- Normal submission UI: existing `partner-admin` and `kvartal-admin` object workflows.
- Normal submission API: `office-api`.
- Platform administration: policies, monitoring, abuse response and exceptional procedures only.
- No parallel Property Identity portal is introduced.

## Supersession

This ADR supersedes all earlier requirements for mandatory platform review of an ordinary Property Identity registration submission. Other non-conflicting security, concurrency, privacy, provenance, representation, offer, publication, wallet and token decisions remain applicable.
