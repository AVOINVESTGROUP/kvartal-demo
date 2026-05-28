# ADR 0001: PostgreSQL as Stage 3 MVP SSOT

**Date:** 2026-05-28  
**Status:** Proposed  
**Decision Owner:** KVARTAL platform owner  
**Related:** `docs/11-STAGE-3-SSOT-ADMIN-PLAN.md`, `docs/02-DATA-MODEL.md`, `docs/03-API-CONTRACTS.md`

## Context

KVARTAL is evolving from a single-company real estate website into a developer-owned multi-office real estate platform.

Stage 3 needs a durable SSOT foundation for:

- organizations/legal entities;
- offices;
- markets;
- property objects;
- client intents;
- office memberships;
- inter-office deal rooms;
- audit logs;
- future subscriptions;
- future commission logic;
- future analytics and reporting.

The platform model is relational by nature:

- offices own objects;
- offices own leads;
- users belong to one or more offices;
- users may be employees of multiple organizations in different countries;
- each organization may have its own administrative hierarchy and operating rules;
- deal rooms connect buyer-side and seller-side offices;
- objects may appear on multiple local sites;
- audit logs must connect actors, offices, entities, and actions.

Firestore was previously considered for MVP speed, but the product owner has clarified that the backend should use a relational database.

## Decision

Use Cloud SQL for PostgreSQL as the Stage 3 MVP SSOT.

PostgreSQL will be the source of truth for core application data, including:

- `offices`
- `organizations`
- `markets`
- `app_users`
- `office_memberships`
- `organization_memberships`
- `site_configs`
- `property_objects`
- `property_object_localizations`
- `property_media`
- `client_intents`
- `client_intent_private_details`
- `co_broker_requests`
- `deal_rooms`
- `deal_room_objects`
- `deal_room_events`
- `audit_logs`
- subscription and analytics placeholder tables

Firebase may still be used for identity/auth and App Hosting, but Firestore is not the Stage 3 SSOT.

Stage 3 starts with dedicated Cloud Run backends:

- `platform-api` for platform owner/operator control plane.
- `office-api` for office operations and local public workflows.

Next.js route handlers are rejected as the Stage 3 backend boundary because the platform and office backends have different access models.

## Rationale

- Multi-office ownership rules map naturally to relational constraints.
- Deal rooms, co-broker requests, membership roles, and audit logs benefit from joins and foreign keys.
- Future billing, subscriptions, commission splits, reporting, and analytics will likely need relational structure.
- Backend-controlled writes can enforce validation, authorization, and audit in transactions.
- PostgreSQL avoids early migration away from a document database once workflows become relational.
- Dedicated Cloud Run services avoid a later migration away from mixed frontend/backend route handlers.

## Consequences

Positive:

- Stronger long-term SSOT foundation.
- Better fit for ownership, roles, deals, and audit.
- Easier reporting and future analytics.
- Clear backend boundary for validation and authorization.
- Clean separation between platform-level and office-level access.
- Less reliance on client-side security rules.

Tradeoffs:

- Slower MVP setup than Firestore.
- Requires database migrations and connection management.
- Requires local PostgreSQL or equivalent dev setup.
- Cloud SQL provisioning and networking must be planned.
- Realtime features will need a separate approach if required later.

## Guardrails

- All writes must go through a trusted backend boundary.
- Frontend code must not connect directly to PostgreSQL.
- Stage 3 protected API logic must live in Cloud Run services, not Next.js route handlers.
- Platform Admin must use `platform-api`.
- Office Admin and public/local site workflows must use `office-api`.
- Backend must verify authenticated identity before protected actions.
- Roles and office memberships are stored in PostgreSQL.
- Client code must not be trusted to set ownership fields.
- Client code must not be trusted to create audit logs.
- Public reads must filter:

```text
status = 'published'
visibility = 'public'
```

- Client PII must be isolated from public object reads and unrelated office access.
- Migration files must be reviewed before execution.
- Production provisioning and production migrations require explicit approval.

## Rejected Alternative

Firestore as Stage 3 SSOT was rejected for this stage because the platform is expected to rely heavily on relational workflows: office memberships, object ownership, lead ownership, co-broker requests, inter-office deal rooms, audit trails, subscriptions, and future commission/reporting logic.

Firestore may be reconsidered later only for narrow supporting use cases, such as realtime notification state, chat-like activity streams, or client-side sync features.

Next.js route handlers as the Stage 3 backend boundary were rejected because the platform has two distinct backend access models from the start: platform-wide administration and office-scoped operations. Combining them inside the frontend app would create avoidable migration and authorization risk.

## Revisit Criteria

Reconsider the database architecture if:

- local development or Cloud SQL operations become too heavy for the project stage;
- the product pivots back to a mostly static single-office website;
- realtime-first collaboration becomes more important than relational workflows;
- another managed relational service becomes preferable for cost, operations, or deployment reasons.
