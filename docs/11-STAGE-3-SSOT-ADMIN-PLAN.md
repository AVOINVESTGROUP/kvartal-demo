# Stage 3: Relational Multi-Office SSOT Backend Plan

**Date:** 2026-05-28  
**Status:** Draft for owner approval  
**Project:** KVARTAL Multi-Office Real Estate Platform  
**Primary references:** `docs/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md`, `docs/02-DATA-MODEL.md`, `docs/03-API-CONTRACTS.md`  
**Related ADR:** `docs/adr/0001-postgresql-mvp-ssot.md`

## 1. Purpose

Stage 3 creates the backend and relational SSOT foundation for KVARTAL as a developer-owned multi-office real estate platform.

The target model is:

```text
Platform Admin
-> Offices
-> Local Sites
-> Relational Property SSOT
-> Client Intents
-> Inter-Office Deal Rooms
```

Stage 3 must make future expansion possible without architectural rework:

- Moscow, Tbilisi, Yerevan, and future offices share one relational database.
- Users are employees of independent organizations that may operate in different countries.
- Each organization may have its own internal administrative hierarchy.
- Each office keeps ownership of the property information it contributes.
- Client requests belong to the source office/site.
- Seller-side and buyer-side offices can later meet in inter-office deal rooms.
- Platform Admin and Office Admin remain separate administrative layers.
- Backend API is the trusted boundary for validation, authorization, and audit.

Stage 3 is not a full brokerage network implementation. It is the smallest safe foundation for relational SSOT, ownership, access control, and future admin workflows.

## 2. Current Project State

Completed:

- Next.js app exists in `apps/web`.
- Firebase App Hosting backend exists: `kvartal-web-dev`.
- Deployment is connected to GitHub `main`; Firebase rollout is triggered by Git push.
- Public website has real KVARTAL company contacts.
- Public object cards currently exist in frontend code.
- Multi-office platform architecture is documented in `docs/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md`.
- Data model draft is documented in `docs/02-DATA-MODEL.md`.
- API/data access contracts are documented in `docs/03-API-CONTRACTS.md`.

Not yet implemented:

- Relational database schema.
- Cloud SQL/PostgreSQL instance or local PostgreSQL development setup.
- ORM/query layer.
- Dedicated Cloud Run platform backend.
- Dedicated Cloud Run office backend.
- Firebase Auth token verification on backend.
- Platform Admin.
- Office Admin.
- Office/user role model.
- Organization/user role model.
- Object ownership enforcement.
- Lead ownership enforcement.
- Inter-office deal rooms.
- Storage upload flow.
- Backend authorization tests.

Known documentation/data quality risk:

- Some older Russian-language project files display mojibake in the current shell output.
- Before seeding public objects into SSOT, object text must be recovered from a known-good UTF-8 source, preferably root `index.html` or the approved design copy.
- Do not migrate mojibake text into PostgreSQL.

## 3. Non-Negotiable Architecture Rules

- Cloud SQL for PostgreSQL is the MVP SSOT for Stage 3, per `docs/adr/0001-postgresql-mvp-ssot.md`.
- Dedicated Cloud Run APIs are the trusted boundary for all reads/writes.
- Platform backend and office backend are separate services with separate access models.
- `platform_owner` is the maximum product role and belongs to the project owner/operator.
- Frontend must not write directly to the database.
- CRM is not the object SSOT.
- The object contributor remains the information rights holder.
- Only the owner office can edit primary object data.
- Organization-level owners/admins may manage their organization's offices according to policy.
- Platform admins may moderate across offices only with audit logging.
- Leads belong to the source office/site.
- Client PII must not be exposed through public object reads or unrelated office access.
- Platform Admin and Office Admin are separate concepts.
- Multilingual and multicurrency structures must be prepared now.
- Monetization is not implemented now, but subscription/feature placeholders must exist.
- Public analytics is not implemented now, but market indicator placeholders must exist.
- Firebase may be used for identity/auth, but roles and office membership belong to the relational SSOT.
- Next.js route handlers must not be used as the Stage 3 backend boundary.
- No deploy, Cloud SQL provisioning, or production migration without explicit approval.
- Root `index.html` remains untouched.

## 4. Stage 3 Scope Strategy

Stage 3 is split into small approval-gated slices.

Each slice must have:

- explicit owner approval before coding;
- narrow file scope;
- lint/build verification where applicable;
- migration review before database changes;
- documentation update after implementation;
- no production database writes unless explicitly approved.

Do not execute all Stage 3 work as one large implementation.

## 5. Stage 3A: Relational Architecture and Schema Draft

### Goal

Define the relational SSOT shape before any backend or admin UI implementation.

### Included

- Confirm PostgreSQL as SSOT in ADR.
- Select ORM/schema tool:
  - selected direction: Prisma, because the team already has project experience with it and the migration/schema workflow is suitable for Stage 3.
- Define backend workspace layout for two Cloud Run services:
  - `apps/platform-api`
  - `apps/office-api`
  - `packages/db`
  - `packages/domain`
  - `packages/auth`
- Add initial relational schema draft for:
  - offices;
  - organizations;
  - markets;
  - users;
  - organization memberships;
  - office memberships;
  - role assignments;
  - site configs;
  - property objects;
  - property object components;
  - flexible property attributes;
  - property economics;
  - AI property intake submissions and drafts;
  - AI/open-source verification results;
  - property media;
  - legal documents and legal document reviews;
  - client intents;
  - co-broker requests;
  - deal rooms;
  - deal-room events;
  - audit logs;
  - subscription placeholders;
  - market analytics placeholders.
- Add TypeScript domain types aligned with the schema.
- Add RBAC model and permission matrix before implementing services.
- Add seed data draft for offices, markets, and current public objects.
- Recover current object text from valid UTF-8 source before converting to seed data.

### Excluded

- Cloud SQL provisioning.
- Production migrations.
- Firebase Auth implementation.
- Admin routes.
- Object CRUD.
- Public API implementation.

### Likely Files

```text
docs/adr/0001-postgresql-mvp-ssot.md
docs/02-DATA-MODEL.md
apps/web/src/lib/domain/*
prisma/schema.prisma or equivalent schema location
```

### Acceptance

- Relational tables and relations are documented.
- Property object model supports simple MVP assets (`land`, `apartment`, `house`) and future complex assets (`industrial_site`, `factory`, `investment_project`).
- Multi-component objects are represented without overloading the core `property_objects` table.
- Flexible characteristics are represented through typed attributes/components/economic tables.
- AI-assisted object intake is represented as draft data and cannot bypass human confirmation.
- Open-source verification results are represented with source, checked date, result, and confidence.
- Ownership fields exist in schema:

```text
property_objects.owner_office_id
property_objects.owner_organization_id
property_objects.information_owner_office_id
property_objects.information_owner_organization_id
client_intents.source_office_id
client_intents.source_organization_id
deal_rooms.seller_office_id
deal_rooms.seller_organization_id
deal_rooms.buyer_office_id
deal_rooms.buyer_organization_id
```

- Audit table exists in schema.
- PII handling is explicitly represented.
- Legal document scope, confidentiality, review status, expiry, and deal-room access are explicitly represented.
- Role scopes and permission checks are explicitly represented.
- Russian seed text is valid UTF-8.
- No production database exists or is mutated unless separately approved.
- `pnpm --filter web lint` passes if app files are touched.
- `pnpm --filter web build` passes if app files are touched.
- Root `index.html` is unchanged.

## 6. Stage 3B: Cloud Run Backend Foundation

### Goal

Create two trusted Cloud Run backend boundaries with different access models.

### Included

- Create `apps/platform-api` as the platform-level backend.
- Create `apps/office-api` as the office/public operational backend.
- Add shared Prisma database package under `packages/db`.
- Add shared domain types under `packages/domain` or keep web-local types only until extraction is needed.
- Add shared auth/authz helpers under `packages/auth` if reused by both services.
- Add database connection layer.
- Add repository/service layer.
- Add API error format.
- Add health check endpoints for both services.
- Add local `.env.example` for database/auth config.
- Add local development database instructions.
- Prepare Cloud Run service names and service-account separation.

### Excluded

- Production Cloud SQL provisioning.
- Full admin UI.
- Full object CRUD.

### Service Boundaries

```text
platform-api:
  purpose: platform owner/operator control plane
  routes: /api/v1/platform/*
  roles: platform_owner, platform_admin, platform_analyst, platform_viewer where applicable
  can manage: offices, markets, site configs, subscriptions, global analytics, moderation, audit inspection

office-api:
  purpose: office operations and local site/public workflows
  routes: /api/v1/public/* and /api/v1/admin/*
  roles: office_owner, office_admin, broker, office_analyst, office_viewer
  can manage: own office context, own objects, own leads, co-broker requests, deal rooms where participant
```

The two services may share Prisma models and domain types, but they must not share authorization assumptions.

## 6.1 User Roles and Access Model

Stage 3 must define RBAC before coding service endpoints.

Users are employees of organizations, not only members of generic offices. An organization can represent a legal entity, brokerage firm, partner company, or operating group. One organization can have multiple offices/branches in one or more countries, each with local administrative rules.

### Role Scopes

Roles have explicit scopes:

```text
platform scope:
  platform_owner
  platform_admin
  platform_analyst
  platform_viewer

organization scope:
  organization_owner
  organization_admin

office scope:
  office_owner
  office_admin
  broker
  office_analyst
  office_viewer
```

Do not use one generic `admin` role.

Do not treat `analyst` or `viewer` as universal roles without scope.

### Platform Roles

| Role | Service | Purpose |
|---|---|---|
| `platform_owner` | `platform-api` | Full platform control, including platform admins, global settings, office lifecycle, subscriptions, moderation, audit inspection, and emergency access. |
| `platform_admin` | `platform-api` | Platform operations except owner-only actions such as assigning/removing `platform_owner` or destructive platform configuration. |
| `platform_analyst` | `platform-api` | Manage platform-level market indicators and insights; no office/user/billing control unless separately granted. |
| `platform_viewer` | `platform-api` | Read-only platform visibility for offices, markets, subscriptions, audit summaries, and analytics drafts where allowed. |

### Office Roles

### Organization Roles

| Role | Service | Purpose |
|---|---|---|
| `organization_owner` | `office-api` | Full control inside one organization, including organization profile, organization users, all organization offices, and organization-level policy. |
| `organization_admin` | `office-api` | Operational control inside one organization, excluding owner-only changes such as legal identity, billing ownership, or removing the organization owner. |

Organization roles do not grant platform access. They may grant access across all offices that belong to that organization.

### Office Roles

| Role | Service | Purpose |
|---|---|---|
| `office_owner` | `office-api` | Full control inside one office: office settings, users, owned objects, leads, deals, and publication decisions. |
| `office_admin` | `office-api` | Operational administration inside one office, excluding owner-only actions such as removing the office owner or changing billing/legal identity. |
| `broker` | `office-api` | Work with assigned or office-visible objects, leads, co-broker requests, and deal rooms; can create objects if office policy allows. |
| `office_analyst` | `office-api` | Read office data and contribute office-scoped analytics/market notes; cannot access private lead PII unless explicitly allowed. |
| `office_viewer` | `office-api` | Read-only office-scoped access; cannot create, edit, publish, archive, or export private data. |

### Core Permission Matrix

| Capability | platform_owner/admin | organization_owner/admin | office_owner/admin | broker | analyst/viewer |
|---|---:|---:|---:|---:|---:|
| Create organization | Yes | No | No | No | No |
| Suspend/archive organization | Yes | No | No | No | No |
| Create office inside organization | Yes | Yes | No | No | No |
| Suspend/archive office | Yes | Own org | Own office policy | No | No |
| Assign platform roles | Owner/limited admin | No | No | No | No |
| Manage organization users | Yes | Own org | No | No | No |
| Manage office users | Yes | Own org | Own office | No | No |
| Manage organization billing/subscription | Yes | View/manage own policy | View own | No | No |
| Create object | Yes | Any own-org office | Own office | Policy | No |
| Edit owned office object | Yes, audit | Own org | Own office | Assigned/policy | No |
| Publish/archive owned object | Yes, audit | Own org | Own office | Policy | No |
| Edit other organization object | Emergency + audit | No | No | No | No |
| Read public object | Yes | Yes | Yes | Yes | Yes |
| Read network-visible object | Yes | Policy | Policy | Policy | Policy |
| Read private own-organization object | Yes | Yes | Own office policy | Assigned/policy | Read policy |
| Read unrelated private object | Emergency + audit | No | No | No | No |
| Create client intent from public site | Public | Public | Public | Public | Public |
| Read own organization lead metadata | Yes | Yes | Own office policy | Assigned/policy | Aggregated/read policy |
| Read own organization lead PII | Policy + audit | Yes | Own office policy | Assigned/policy | No by default |
| Read unrelated organization lead PII | Emergency + audit | No | No | No | No |
| Create co-broker request | Yes | Own org | Own office | Yes | No |
| Accept/decline co-broker request | Yes | Own org | Own office | Assigned/policy | No |
| Create deal room | Yes | Own org | Own office | Assigned/policy | No |
| Read deal room | Yes | Participant org | Participant office | Assigned/participant | Read policy |
| Change deal-room status | Yes, audit | Participant org | Participant office | Assigned/policy | No |
| Publish platform analytics | Yes | No | No | No | Platform analyst only |
| View audit logs | Yes | Own org summary | Own office summary | No | Summary policy |

### Access Rules

- Platform role does not automatically grant office membership.
- `platform_owner` has maximum product authority over all organizations/offices, but private data, lead PII, and emergency/moderation access must be audited.
- Organization role does not grant platform access.
- Office role does not grant organization-wide access unless paired with organization membership.
- Platform emergency/moderation access must create audit logs.
- Office users can act only within `activeOfficeId`.
- Organization users can act only within `activeOrganizationId`.
- `activeOfficeId` must belong to `activeOrganizationId`.
- A user may have memberships in multiple offices, but every office-scoped request must resolve exactly one active office.
- A user may be an employee of multiple organizations, but every organization-scoped request must resolve exactly one active organization.
- Lead PII is more restricted than lead metadata.
- Public users can read only published public objects and can create public client intents.
- Subscription status may restrict office capabilities later; do not hardcode unlimited access.
- Backend authorization must check both role and resource ownership/participation.

### Acceptance

- Both Cloud Run service apps can connect to local/dev PostgreSQL.
- Both services expose health endpoints that verify app and database connectivity without exposing secrets.
- API errors use the documented JSON error shape.
- No client component talks directly to the database.
- No Next.js route handlers are used as the primary backend boundary.
- No secrets are committed.

## 7. Stage 3C: Public Objects API and Frontend Repository

### Goal

Move the public storefront to backend-backed repository access while preserving visual design.

### Included

- Add public API:

```text
GET /api/v1/public/objects
GET /api/v1/public/objects/{id}
```

- Public APIs are served by `office-api`, because public requests are tied to local sites, source offices, and future lead ownership.
- Enforce public query rule:

```text
status = 'published'
visibility = 'public'
```

- Add frontend repository for public property reads.
- Keep local seed fallback for development only if API/database is not configured.
- Update `apps/web/src/components/Objects.tsx` to use typed repository-shaped data.
- Add database indexes for public object queries.

### Required Public Query Indexes

```text
property_objects(status, visibility, published_at)
property_objects(market_id, status, visibility, published_at)
property_objects(owner_office_id, status, visibility, published_at)
property_objects(asset_class, status, visibility, published_at)
```

### Acceptance

- Public website renders objects from API/repository.
- Draft/private/network-only objects are not returned publicly.
- PII is not present in public object responses.
- Current public design direction is preserved.
- `pnpm --filter web lint` passes.
- `pnpm --filter web build` passes.

## 8. Stage 3D: Auth and Authorization Foundation

### Goal

Create safe authenticated access before building admin CRUD.

### Included

- Use Firebase Auth for identity unless a later ADR replaces it.
- Both Cloud Run backends verify Firebase ID tokens for protected requests.
- Store platform roles, organization memberships, and office memberships in PostgreSQL.
- Add auth context resolver.
- Add active organization and active office context pattern for users who belong to multiple organizations/offices.
- Create protected `/platform` shell.
- Create protected `/admin` shell.

### Required Auth Context

```ts
type RequestAuthContext = {
  uid: string;
  email?: string;
  platformRoles: PlatformRole[];
  organizationMemberships: Array<{
    organizationId: string;
    roles: OrganizationRole[];
  }>;
  officeMemberships: Array<{
    organizationId: string;
    officeId: string;
    roles: OfficeRole[];
  }>;
  activeOrganizationId?: string;
  activeOfficeId?: string;
};
```

### Rules

- Authorization checks must use resolved auth context, not raw email checks.
- `/platform` requires `platform_owner` or `platform_admin`.
- `/admin` requires active office membership.
- Organization-level actions require `organization_owner` or `organization_admin` for the active organization.
- Platform UI must call `platform-api`.
- Office Admin UI must call `office-api`.
- A user may belong to multiple organizations/offices only if active organization and active office selection rules are implemented.
- Roles are read from PostgreSQL, not hardcoded in frontend code.

### Acceptance

- Unauthenticated users cannot access `/platform` or `/admin`.
- Office user cannot access `/platform` without platform role.
- Platform admin can access `/platform`.
- Office user with membership can access `/admin`.
- Auth and role decisions are documented in `docs/CURRENT_STATE.md`.
- RBAC checks are covered in service-level tests before admin CRUD is considered complete.
- `pnpm --filter web lint` passes.
- `pnpm --filter web build` passes.

## 9. Stage 3E: Office Object CRUD Through Backend

### Goal

Allow office users to create and manage owned property objects with backend validation, database transactions, and audit.

### Included

- Add backend endpoints or server actions for:
  - list own objects;
  - create object;
  - edit owned object;
  - publish owned object;
  - archive owned object.
- Add Office Admin object routes:
  - `/admin/objects`
  - `/admin/objects/new`
  - `/admin/objects/[id]`
- Add schema validation before writes.
- Server must set ownership fields.
- Privileged platform moderation must create audit log entries.
- Office object CRUD belongs to `office-api`.
- Cross-office moderation belongs to `platform-api`.

### Server-Set Fields

```text
owner_office_id = active office
information_owner_office_id = active office
created_by_user_id = current uid/user id
created_at = database timestamp
updated_at = database timestamp
```

### Audit Rule

All privileged mutations must write audit entries in the same trusted backend flow, preferably in the same database transaction where practical.

Do not rely on client code to create audit logs.

### Acceptance

- Office user can create an object owned by active office.
- Office user can edit own office object.
- Office user cannot edit another office object.
- Platform admin moderation creates audit log entry.
- Public users still see only published public objects.
- `pnpm --filter web lint` passes.
- `pnpm --filter web build` passes.

## 10. Stage 3F: Seed Script, Cloud SQL Prep, and Controlled Bootstrap

### Goal

Create an idempotent bootstrap path for initial offices, markets, site configs, users, and public objects.

### Included

- Add seed script with dry-run mode.
- Add local seed data for:
  - Moscow office;
  - Tbilisi office;
  - Yerevan office;
  - Moscow market;
  - Tbilisi market;
  - Yerevan market.
- Seed current public objects only after UTF-8 recovery.
- Add first platform admin bootstrap method.
- Prepare Cloud SQL provisioning checklist.
- Prepare migration checklist.

### Rules

- Seed script must be idempotent.
- Seed script must support dry-run.
- Production seed requires explicit owner approval.
- Cloud SQL provisioning requires explicit owner approval.
- Cloud Run service creation/deployment requires explicit owner approval.
- No `.env.local` or secrets may be committed.

### Acceptance

- Dry-run shows planned writes without touching production.
- Seed can create/update deterministic records.
- Current public objects are seeded with:
  - `owner_office_id = office_moscow`;
  - valid `market_id`;
  - `status = published`;
  - `visibility = public`;
  - `price_mode = on_request`;
  - localized Russian text;
  - original image URLs.
- First platform admin bootstrap method is documented.

## 11. Recommended Tables

Recommended relational tables:

```text
organizations
offices
markets
app_users
organization_memberships
office_memberships
site_configs
property_objects
property_object_localizations
property_object_components
property_object_attributes
property_object_economics
property_media
property_documents
legal_documents
legal_document_reviews
property_intake_submissions
property_ai_drafts
property_ai_extraction_events
property_ai_external_checks
client_intents
client_intent_private_details
co_broker_requests
deal_rooms
deal_room_objects
deal_room_events
subscription_plans
office_subscriptions
currency_rate_snapshots
market_indicators
market_insights
audit_logs
```

Stage 3 physical implementation may start with:

```text
organizations
offices
markets
app_users
organization_memberships
office_memberships
site_configs
property_objects
property_object_localizations
property_object_components
property_object_attributes
property_object_economics
property_media
legal_documents
legal_document_reviews
property_intake_submissions
property_ai_drafts
property_ai_external_checks
client_intents
client_intent_private_details
co_broker_requests
deal_rooms
deal_room_objects
audit_logs
```

Tables may be modeled before they receive UI.

## 12. Required Domain Types

Create shared domain types in the web app first. Extract to a shared package later only if another app or service needs them.

Recommended initial location:

```text
apps/web/src/lib/domain/
```

Types:

- `LanguageCode`
- `LocalizedText`
- `CurrencyCode`
- `MoneyValue`
- `Price`
- `Organization`
- `Office`
- `Market`
- `AppUser`
- `OrganizationMembership`
- `OfficeMembership`
- `SiteConfig`
- `PropertyObject`
- `PropertyObjectLocalization`
- `PropertyObjectComponent`
- `PropertyObjectAttribute`
- `PropertyObjectEconomics`
- `PropertyIntakeSubmission`
- `PropertyAIDraft`
- `PropertyAIExternalCheck`
- `PropertyMedia`
- `LegalDocument`
- `LegalDocumentReview`
- `ClientIntent`
- `CoBrokerRequest`
- `InterOfficeDealRoom`
- `DealRoomEvent`
- `AuditLogEntry`

## 13. Public Website Rules

Current public object section exists in:

```text
apps/web/src/components/Objects.tsx
```

Stage 3 target:

- keep approved visual direction;
- move object data behind API/repository layer;
- support backend read path for published public objects;
- keep local fallback/seed data for development only;
- do not expose draft/private/network-only objects publicly;
- do not migrate mojibake text.

Public object query rule:

```text
status = 'published'
visibility = 'public'
```

## 14. Client Intent and PII Rules

Client requests belong to the source office/site.

Stage 3 data model must prevent accidental PII exposure:

- public object reads must never include lead/client fields;
- unrelated offices must not read full `client_name`, `client_contact`, or private requirement details;
- deal-room participants may receive only deal-relevant lead details after approved cooperation flow;
- private lead fields should live in `client_intent_private_details` or an equivalent protected structure.

Before implementing public lead creation, confirm exact PII split and retention rules.

## 15. Deal Room State Rule

Current Stage 3 model allows:

```text
draft -> sent -> viewed -> active -> closed
draft -> archived
sent -> archived
active -> archived
```

This expands the older rule that ended at `archived`.

Before implementing deal-room mutations, update the active deal-room rule document or add an ADR so agents do not follow conflicting state machines.

## 16. Deployment and Infrastructure Method

Frontend deployment remains Git-driven:

```text
commit -> push to main -> Firebase App Hosting rollout
```

Backend and database infrastructure require separate approval before provisioning or production migration.

Do not use Firebase CLI deploy, Cloud SQL provisioning, or production database migration unless explicitly requested.

Before push:

- lint passes;
- build passes;
- migration files reviewed;
- staged files reviewed;
- no `.env.local`;
- no secrets;
- no cache/log files;
- no accidental screenshots;
- no production database writes unless approved.

## 17. Open Decisions Before Stage 3A

Need owner approval:

1. Confirm Cloud SQL/PostgreSQL as Stage 3 MVP SSOT.
2. Confirm Stage 3A as the first implementation slice.
3. Confirm Prisma as the Stage 3 ORM/schema tool.
4. Confirm two Cloud Run services from the start: `platform-api` and `office-api`.
5. Confirm initial office IDs: `office_moscow`, `office_tbilisi`, `office_yerevan`.
6. Confirm initial market IDs: `market_moscow`, `market_tbilisi`, `market_yerevan`.
7. Confirm initial languages: `ru` only, or `ru` + `en`.
8. Confirm initial currencies: `RUB` + `USD`, or include `GEL` and `AMD` immediately.
9. Confirm whether current public objects should be recovered from root `index.html`.

## 18. Open Decisions Before Stage 3B-3F

Need owner approval before later slices:

1. Local PostgreSQL setup method.
2. Cloud SQL region and instance sizing.
3. Database connection method from Cloud Run to Cloud SQL.
4. Firebase Auth token verification approach.
5. Cloud Run service accounts and IAM separation for platform and office APIs.
6. First platform admin creation method: Firebase Console + seed, local seed script, or protected bootstrap script.
7. Whether one user can belong to multiple offices in MVP.
8. Active office selection UX and persistence.
9. Whether `/platform` should be a real UI in Stage 3 or a protected shell with simple lists.
10. Whether media upload is required in Stage 3 or can remain a typed placeholder.
11. Whether co-broker requests are created automatically or require owner-office approval.
12. Whether production database provisioning and seed are allowed after local verification.

## 19. Recommended Immediate Next Step

After owner approval, implement only:

```text
Stage 3A: Relational Architecture and Schema Draft
```

Do not start Firebase Auth, admin CRUD, Cloud Run deployment, Cloud SQL provisioning, or production seed until Stage 3A is verified and approved.
