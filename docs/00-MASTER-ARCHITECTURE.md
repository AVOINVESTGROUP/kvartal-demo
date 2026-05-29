# Fixer.guru / KVARTAL Master Architecture

**Status:** current source of truth  
**Date:** 2026-05-29  
**Owner:** Fixer.guru platform owner/operator  
**Purpose:** one master document that explains the project from idea to implementation architecture.

This is the current source of truth for the product and technical architecture. Detailed child documents remain active where they provide deeper contracts, schemas, implementation notes, or operational history.

## 1. Product Idea

Fixer.guru owns and operates a partner-network real estate platform.

The platform connects independent real estate partner organizations through:

- one governed property and deal database;
- branded public partner websites;
- a shared public inventory layer;
- partner organization admin workspaces;
- Fixer.guru platform owner administration;
- controlled access to private data;
- co-broker deal flow;
- future monetization of access, leads, cooperation, AI processing, analytics, and platform services.

The platform is not a set of unrelated websites. It is one rights-aware data and deal network where each partner can have its own brand and clients while using the common platform infrastructure.

## 2. Document Map

Active child documents:

- [`docs/02-DATA-MODEL.md`](02-DATA-MODEL.md) - PostgreSQL/Prisma data model, ownership, legal documents, AI intake placeholders.
- [`docs/03-API-CONTRACTS.md`](03-API-CONTRACTS.md) - Cloud Run API boundaries and endpoint contracts.
- [`docs/05-DEAL-ROOM-SPEC.md`](05-DEAL-ROOM-SPEC.md) - deal room behavior and state model.
- [`docs/06-AI-SYSTEM.md`](06-AI-SYSTEM.md) - AI system direction and guardrails.
- [`docs/13-ROLE-SCHEMA-DRAFT.md`](13-ROLE-SCHEMA-DRAFT.md) - approved baseline roles and permissions.
- [`docs/14-AI-PROPERTY-INTAKE.md`](14-AI-PROPERTY-INTAKE.md) - AI-assisted property card creation.
- [`docs/15-GOOGLE-DATA-GOVERNANCE.md`](15-GOOGLE-DATA-GOVERNANCE.md) - BigQuery, Dataplex, Dataform, and governance layer.
- [`docs/16-PARTNER-NETWORK-PLATFORM.md`](16-PARTNER-NETWORK-PLATFORM.md) - partner-network product architecture.
- [`docs/17-PARTNER-NETWORK-IMPLEMENTATION-PLAN.md`](17-PARTNER-NETWORK-IMPLEMENTATION-PLAN.md) - implementation roadmap.
- [`docs/18-GOOGLE-ACCOUNT-AUTH.md`](18-GOOGLE-ACCOUNT-AUTH.md) - Firebase Google account admin auth.
- [`docs/CURRENT_STATE.md`](CURRENT_STATE.md) - factual implementation and deployment state.
- [`docs/FIREBASE_APP_HOSTING_TROUBLESHOOTING.md`](FIREBASE_APP_HOSTING_TROUBLESHOOTING.md) - operational fixes and deployment lessons.
- [`docs/AGENT_MISTAKES_LOG.md`](AGENT_MISTAKES_LOG.md) - recurring agent mistakes and prevention notes.

Historical and superseded documents live in [`docs/archived/superseded/`](archived/superseded/).

## 3. Business Roles

### Fixer.guru

Fixer.guru is the platform owner/operator.

Fixer.guru controls:

- Google Cloud/Firebase infrastructure;
- platform access and global roles;
- partner onboarding and suspension;
- data access policy;
- subscriptions and future monetization;
- platform-wide audit and moderation;
- shared inventory rules;
- platform admin tooling.

### Partner Organization

A partner organization is a real estate company connected to the platform.

Initial and planned partner organizations:

- KVARTAL Moscow;
- Apart4u.co Tbilisi;
- future Dubai partner;
- future Yerevan partner;
- future partner firms.

Each partner organization can have:

- its own branded public website;
- its own organization admin workspace;
- one or more offices/branches;
- employees and roles;
- owned objects, leads, documents, and deal participation;
- its own third public language in addition to Russian and English.

### Office / Branch

An office is a local operating branch inside a partner organization. It is not the main platform tenant.

Example:

```text
Partner organization: Apart4u.co
  Office: Tbilisi Office

Partner organization: KVARTAL Moscow
  Office: Moscow Office
```

## 4. Product Surfaces

### Platform Admin

`apps/platform-admin` is the Fixer.guru owner console.

It manages:

- platform roles;
- partner organization access by Gmail;
- partner owners and Fixer.guru team members;
- platform-wide settings and future subscriptions;
- audit, moderation, and partner oversight.

### Partner Admin

`apps/partner-admin` is the intended universal organization admin for all partner organizations.

It must manage:

- own organization profile and offices;
- organization employees;
- owned property objects;
- object publication and media;
- legal documents;
- own leads;
- co-broker requests and deal rooms;
- visibility of individual partner objects on that organization's public site.

Current note: `apps/kvartal-admin` is a working organization-admin implementation for KVARTAL Moscow. It should be used as the functional baseline for the shared `partner-admin`.

### Partner Public Site

`apps/partner-site` is the multi-tenant public site engine.

Each partner site has:

- tenant key;
- organization slug;
- domain/subdomain;
- theme/design module;
- assets;
- contacts;
- public languages;
- shared inventory rendering.

The HTML provided for a new partner is a design source, not a separate application.

## 5. Shared Public Inventory

Shared Public Inventory means the common published pool of objects approved for display on different partner websites in each partner's own design.

An object can appear on another partner site only if it is:

- published;
- public;
- allowed for shared display by the information rights holder / platform rule.

Public inventory never exposes:

- legal documents;
- lead PII;
- private owner/seller contacts;
- confidential seller terms;
- internal economics;
- commission terms;
- AI verification conflicts;
- hidden address details;
- draft or archived records.

Partner organizations can hide individual partner objects from their own site without editing the object. This is stored as a site/organization-scoped visibility override.

## 6. Data Ownership

The organization that contributes information remains the information rights holder for that information.

This rule applies to:

- property objects;
- legal documents;
- private notes;
- AI intake materials;
- verification results;
- organization-owned operational records.

Other partners may display published public showcase fields or participate in approved deal workflows, but they cannot edit primary data owned by another organization.

Fixer.guru platform owner access to private data must be controlled by policy and audited.

## 7. Roles and Access

Role families:

- platform roles: `platform_owner`, `platform_admin`, `platform_analyst`, `platform_viewer`;
- organization roles: `organization_owner`, `organization_admin`;
- office roles: `office_owner`, `office_admin`, `broker`, `office_analyst`, `office_viewer`;
- public user roles/contact types may be added later for property owners, buyers, tenants, and investors.

Rules:

- platform roles are global and enforced by platform APIs;
- organization and office roles are membership-scoped and enforced by partner/office APIs;
- platform role does not automatically create organization membership;
- organization/office role does not grant platform admin access;
- private data access must check membership, ownership, deal-room participation, confidentiality, and audit policy.

## 8. Language Model

Every partner organization should support:

- `ru` - permanent platform language;
- `en` - permanent platform language;
- one third organization language chosen when the organization is created.

Examples:

- KVARTAL Moscow: `ru`, `en`, optional third language if configured;
- Apart4u.co: `ru`, `en`, `ka`;
- Dubai partner: `ru`, `en`, `ar`;
- Yerevan partner: `ru`, `en`, `hy`.

Partner admin must support editing public content for all supported organization languages. The admin interface itself may initially remain Russian.

Public partner sites build their language switcher from the tenant/site config and use configured fallback rules when object localization is missing.

## 9. Data and Backend Architecture

The transactional SSOT is Cloud SQL for PostgreSQL managed through Prisma.

The database stores:

- organizations, offices, users, and memberships;
- markets;
- site configs;
- property objects and localizations;
- property components, attributes, economics, media, and documents;
- legal documents and review records;
- AI intake submissions, drafts, external checks, and extraction events;
- leads/client intents;
- co-broker requests;
- deal rooms and events;
- subscriptions and monetization placeholders;
- audit logs;
- analytics placeholders.

Backend services are Cloud Run services:

- `platform-api` for Fixer.guru platform control;
- current `office-api` for partner organization operations and public inventory;
- target terminology: split/rename toward `partner-api` and `public-api` when the boundary is ready.

Frontend apps do not receive direct database credentials. They call Cloud Run APIs using App Hosting service identity where required.

## 10. Hosting and Auth

Primary frontend hosting is Firebase App Hosting.

Current and target app surfaces:

- `apps/web` - KVARTAL public site / platform public site;
- `apps/platform-admin` - Fixer.guru owner console;
- `apps/partner-admin` - universal partner organization console;
- `apps/partner-site` - multi-tenant partner public websites;
- `apps/kvartal-admin` - current dedicated working KVARTAL organization admin, to be consolidated into the shared partner-admin pattern.

Admin authentication uses Firebase Auth with Google accounts.

Access is decided by PostgreSQL roles and memberships after Firebase proves the Google identity.

Do not use hand-written Google OAuth clients for admin sign-in.

## 11. AI System

AI supports the platform but does not become SSOT truth.

AI workstreams:

- client intent qualification;
- AI-assisted property intake from unstructured text, files, PDFs, photos, and notes;
- open-source plausibility and актуальность checks where legally and technically allowed;
- broker/deal-room summaries;
- future analytics assistant.

Guardrails:

- AI drafts data, humans confirm canonical writes;
- AI does not set ownership fields;
- AI does not publish objects;
- AI does not overwrite primary object data without human approval;
- AI does not make legal conclusions;
- AI does not promise guaranteed investment returns;
- AI verification conflicts require human review;
- all AI extraction and confirmation events must be auditable.

## 12. Deal Room and Co-Broker Flow

The platform separates object ownership from client ownership.

Example flow:

```text
Client opens apart4u.co.
Client sees a Moscow object owned by KVARTAL Moscow.
Client submits a request on apart4u.co.
Lead belongs to Apart4u.co as buyer-side organization.
Object remains controlled by KVARTAL Moscow as seller-side/information-owner organization.
System creates a co-broker request or deal room.
Apart4u.co represents the buyer.
KVARTAL Moscow represents the seller.
Commission split and platform fee are agreement-specific.
```

Deal room records must track:

- buyer-side organization/office;
- seller-side organization/office;
- client intent / lead;
- related property objects;
- co-broker request state;
- legal documents and participant access;
- events and audit history;
- future commission agreement and platform fee policy.

## 13. Legal Documents

Legal documents are separate from public media and descriptions.

They may be attached to:

- organization;
- office;
- property object;
- client intent / lead;
- deal room;
- transaction workflow.

Documents are private by default. Access depends on scope, confidentiality, organization/office membership, deal-room participation, and platform audit policy.

Legal document verification status is not a legal opinion by itself.

## 14. Google Data Governance

PostgreSQL remains transactional SSOT.

Google data layer:

- BigQuery datasets for raw, curated, and governance data;
- BigQuery federated connection to Cloud SQL;
- Dataplex lake and zones;
- Data Catalog policy tags for sensitivity;
- Dataform transformations and future assertions.

The analytics layer must respect data sensitivity, legal documents, PII boundaries, and AI verification conflict visibility.

## 15. Partner Site Factory

New partner websites must be created by configuration, not by re-explaining architecture.

Input from owner:

- partner organization details;
- HTML design source;
- images/assets;
- domain;
- contacts;
- third organization language;
- market/city focus.

Implementation output:

- organization and office records;
- tenant/site config;
- theme module;
- assets copied into the correct public directory;
- public site route/domain;
- partner admin access through Google account membership;
- shared inventory enabled according to platform rules.

## 16. Current Roadmap

Near-term priorities:

1. Keep documentation aligned around this master architecture.
2. Consolidate organization admin behavior so KVARTAL and Apart4u use the same partner-admin code path.
3. Implement Apart4u public site from `C:\Dev\Apart4U\apart.html` and `Apart4Upic.jpeg`.
4. Add three-language public site support: `ru`, `en`, and organization third language.
5. Add three-language object content editing in partner admin.
6. Continue AI property intake and deal room implementation only after data ownership and partner-site/admin factory boundaries stay correct.

## 17. Non-Negotiable Rules

- Fixer.guru is platform owner/operator.
- Partner organizations do not own the platform.
- Office is a branch inside a partner organization.
- Shared object database is SSOT.
- Object contributor remains information rights holder.
- Leads belong to the source site/partner organization.
- Partner sites can display eligible objects from other partners.
- Public showcase data is a safe subset only.
- Private legal, lead, AI conflict, and economic data is not public by default.
- Admin access uses Google/Firebase Auth plus PostgreSQL roles.
- PostgreSQL/Cloud SQL is the transactional SSOT.
- Firebase App Hosting is primary frontend hosting.
- Cloud Run APIs own backend writes.
- Root `index.html` remains untouched.
- Do not claim a file has broken encoding based only on terminal output; verify the file itself first.
