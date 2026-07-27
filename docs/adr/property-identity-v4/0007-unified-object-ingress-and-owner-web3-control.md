# ADR 0007: Unified object ingress and owner-controlled Web3

Date: 2026-07-26
Status: accepted; Web3 governance and partner-right sections amended by ADR 0009

## Context

Every partner organisation already creates, edits and publishes property objects in the existing object workspace. The deployed Property Identity increment added a separate `/property-identity` author surface and enabled a market rollout that blocks the ordinary object form. That split is not the intended product architecture.

Property Identity is one platform-wide registry for all partner organisations. Jurisdiction and market policies describe how identifiers are interpreted; they do not create separate registries.

The current implementation is an off-chain PostgreSQL identity foundation only. It must not be described as a completed Web3 registry.

## Decision

### Partner workflow

- The existing object form is the only partner-facing ingress for manual and Drive/AI object creation.
- Registry checks, correction states and create-or-link decisions are embedded in the object editor and object list.
- Partners do not navigate to a separate Property Identity page and do not manage blockchain infrastructure.
- A unique physical property creates one `PropertyObject` and one `PropertyIdentityProfile`.
- An exact existing property does not create another physical object. It creates organisation-specific representation, offer and publication records when the relevant stage is implemented.
- Publication is the partner organisation's declaration that its authority is supported by attached documents. It is not an application for platform-owner approval.
- A buyer-side request targets a selected active offer; the server derives the seller-side organisation and office from that offer.
- Partner users may see public-safe identity/token status on their object card. They do not receive contract administration or blockchain incident controls.

### Platform owner workflow

`apps/platform-admin` is the only management and monitoring surface for Web3 operations. The platform owner controls:

- chain and contract registry configuration;
- the one platform administration wallet bound to `office@integrayachtsuae.com`;
- token mint, version update, suspend, revoke and reassignment operations;
- organisation wallet binding/recovery policy;
- transaction queues, confirmations, retries and dead letters;
- PostgreSQL/blockchain reconciliation and mismatch incidents;
- emergency freeze/pause controls;
- complete audited operational history.

Each partner organisation binds its own corporate wallet from the partner cabinet. The canonical token is not a title token and representation is recorded as a separate token-to-wallet relation. Partner employees never administer the registry contract or the platform blockchain operation queue.

### Rollout

- Registry tables and identity namespace are global.
- Authority policies may be jurisdiction/market specific.
- Rollout flags may be scoped for safe piloting but must never introduce a separate user workflow or a separate registry.
- No rollout may block the existing object form until the unified ingress is deployed and passes authenticated end-to-end tests.

## Immediate correction

1. Disable the Moscow `NEW_SUBMISSIONS_ONLY` rollout.
2. Remove partner links to `/property-identity` and redirect stale bookmarks to the object workspace.
3. Preserve the off-chain schema, encryption, digest uniqueness, audit history and recovered authentication foundation.
4. Integrate secure ActorContext identity handling into the ordinary object workflow.
5. Implement representation/offer/publication separation before enabling cross-partner exact-link publication.
6. Implement the Web3 control plane in `platform-admin`/`platform-api` only and validate it before BSC Mainnet activation.

## Supersession

ADR 0004 remains evidence of the previous implementation but its decision to expose `/property-identity` in partner cabinets is superseded. The author-owned lifecycle remains valid as an internal object-ingress state machine, not as a separate partner product surface.
