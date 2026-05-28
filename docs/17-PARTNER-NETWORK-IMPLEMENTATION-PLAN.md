# Partner Network Implementation Plan

**Date:** 2026-05-28  
**Status:** Draft for approval  
**Depends on:** `docs/16-PARTNER-NETWORK-PLATFORM.md`

## 1. Goal

Move the current project from "one public site plus experimental admin pages" to a correct Fixer.guru partner-network architecture:

```text
Fixer.guru owns the platform.
Partner organizations have their own branded sites and admin workspaces.
All partner sites can show eligible shared inventory.
Leads, object ownership, deal sides, and commissions are tracked.
Access to data is controlled and monetizable.
```

## 2. Naming Correction

Replace the product language:

```text
office-admin -> partner-admin
office-api   -> partner-api
organization-site -> partner-site
```

Keep `Office` as a data entity for branches/cities inside a partner organization.

Do not use "office" as the name of the main partner-facing app or backend.

## 3. Target Repository Structure

```text
apps/web
apps/platform-admin
apps/partner-admin
apps/partner-site
apps/platform-api
apps/partner-api
apps/public-api
packages/db
packages/auth
packages/domain
packages/ui
packages/tenant-config
```

### apps/web

Main Fixer.guru/KVARTAL public platform site if needed.

It must not contain partner admin pages.

### apps/platform-admin

Fixer.guru owner console.

Initial screens:

- partner organizations;
- partner sites/domains;
- access plans;
- shared inventory grants;
- audit log;
- subscriptions;
- co-broker oversight;
- platform settings.

### apps/partner-admin

Multi-tenant partner organization console.

Initial screens:

- organization dashboard;
- offices/branches;
- users and roles;
- own objects;
- object publication;
- own leads;
- co-broker requests;
- deal rooms;
- legal documents;
- commission agreements.

### apps/partner-site

Multi-tenant public site engine.

Initial tenants/themes:

- Apart4u.co Tbilisi from `C:\Dev\Apart4U\apart.html`;
- KVARTAL Moscow from existing approved design;
- Yerevan placeholder theme;
- Dubai placeholder theme.

### apps/platform-api

Fixer.guru platform owner API.

### apps/partner-api

Authenticated partner operations API.

### apps/public-api

Safe public read and lead-intake API for partner sites.

## 4. Deployment Structure

Each app gets its own Firebase App Hosting backend.

```text
kvartal-web-dev
  app: apps/web
  domains:
    kvartal-pro.ru or platform public domain

fixer-platform-admin-dev
  app: apps/platform-admin
  domains:
    admin.fixer.guru
    platform-admin internal domain

partner-admin-dev
  app: apps/partner-admin
  domains:
    console.fixer.guru
    admin.apart4u.co
    admin.kvartal-pro.ru

partner-site-dev
  app: apps/partner-site
  domains:
    apart4u.co
    kvartal-pro.ru
    future-yerevan-domain
    future-dubai-domain
```

APIs stay on Cloud Run:

```text
platform-api
partner-api
public-api
```

`public-api` may be exposed publicly. `platform-api` and `partner-api` require authentication.

## 5. Tenant Resolution

Partner site tenant can be resolved by domain:

```text
apart4u.co -> partnerOrganization: Apart4u.co
kvartal-pro.ru -> partnerOrganization: KVARTAL Moscow
future.am -> partnerOrganization: Yerevan Partner
future.ae -> partnerOrganization: Dubai Partner
```

Partner admin tenant can be resolved by:

- authenticated user's organization memberships;
- admin domain;
- selected active organization if user belongs to multiple partners.

Platform admin is not tenant-scoped. It belongs to Fixer.guru platform roles.

## 6. Data Model Additions / Renames

Do not necessarily rename database tables immediately if migrations would be noisy, but add/align concepts.

Required concepts:

```text
PartnerSite
PartnerSiteTheme
PartnerDomain
SharedInventoryGrant
ObjectPublishingRule
LeadSourceSite
CoBrokerRequest
DealRoom
CommissionAgreement
CommissionSplit
PlatformFee
BillingEvent
DataAccessPlan
```

Required fields for property objects:

```text
ownerOrganizationId
ownerOfficeId
informationOwnerOrganizationId
informationOwnerOfficeId
sellerSideOrganizationId
sellerSideOfficeId
visibility
publicationStatus
sharedToPartnerNetwork
requiresOwnerApprovalForLead
```

Required fields for leads/client intents:

```text
sourceSiteId
sourceDomain
buyerSideOrganizationId
buyerSideOfficeId
objectOwnerOrganizationId
sellerSideOrganizationId
sellerSideOfficeId
clientPIIStorageBoundary
```

Required fields for deal rooms:

```text
buyerSideOrganizationId
buyerSideOfficeId
sellerSideOrganizationId
sellerSideOfficeId
commissionAgreementId
platformFeePolicyId
```

## 7. Public Inventory Rules

Public partner sites can request inventory from `public-api`.

`public-api` must only return:

```text
visibility = public
publicationStatus = published
allowed for requesting partner site or public network
```

It must not return:

- private notes;
- legal documents;
- lead PII;
- owner private contacts;
- exact hidden address;
- internal economics;
- commission terms;
- AI conflict data;
- draft or archived objects.

## 8. Co-Broker Flow

Initial flow:

```text
Client opens apart4u.co.
Client sees Moscow object.
Client submits lead.
Lead source site = apart4u.co.
Buyer-side organization = Apart4u.co.
Object owner / seller-side organization = KVARTAL Moscow.
System creates co-broker request.
KVARTAL Moscow accepts or declines.
If accepted, deal room opens.
Commission agreement is attached.
Deal progresses with two sides.
```

Later modules:

- negotiation timeline;
- document exchange;
- commission split negotiation;
- partner chat/notifications;
- Telegram Mini App updates;
- platform fee billing events.

## 9. Access and Monetization Rules

Partner organization access is controlled by:

- subscription status;
- access plan;
- shared inventory grants;
- object publishing rules;
- role membership;
- deal participation;
- explicit owner-side approval;
- platform policy.

Example plans:

```text
Partner Basic:
  own site
  own objects
  own leads
  public network inventory view
  co-broker requests limited

Partner Pro:
  expanded shared inventory access
  more users
  premium publication
  analytics access
  more co-broker workflow automation

Partner Enterprise:
  custom domains
  advanced analytics
  API/export permissions if approved
  custom commission/platform fee terms
```

## 10. Apart4u.co First Tenant

Use Apart4u.co as the first partner-site validation case.

Inputs:

```text
C:\Dev\Apart4U\apart.html
C:\Dev\Apart4U\Apart4Upic.jpeg
```

Target:

```text
Partner Organization:
  Apart4u.co

Office:
  Tbilisi Office

Market:
  Tbilisi / Georgia

Public site:
  apart4u.co

Theme:
  dark background
  gold accent
  Apart4U brand
  Tbilisi positioning
```

Behavior:

- shows Apart4u own objects when published;
- shows Moscow/Dubai/Yerevan shared objects when public/network rules allow;
- all leads from this site belong to Apart4u.co as buyer-side organization;
- if object belongs to another partner, create co-broker request/deal room.

## 11. Migration Plan From Current State

### Step 1: Documentation Approval

- Approve `docs/16-PARTNER-NETWORK-PLATFORM.md`.
- Approve this implementation plan.
- Freeze terminology:
  - platform owner = Fixer.guru;
  - connected companies = partner organizations;
  - offices = branches inside partner organizations.

### Step 2: Undo Wrong App Placement

- Remove `/admin/*` from `apps/web`.
- Keep `apps/web` public-only.
- Move existing admin UI prototype into the correct apps.

### Step 3: Create Separate Apps

- Create `apps/platform-admin`.
- Create `apps/partner-admin`.
- Create `apps/partner-site`.
- Add separate `apphosting.yaml` for each app.
- Add build scripts and workspace entries.

### Step 4: Rename Backend Boundary

- Rename concept `office-api` to `partner-api`.
- Either physically rename `apps/office-api` now or introduce `apps/partner-api` and retire `office-api`.
- Add `public-api` as a separate service for public inventory and lead intake.

### Step 5: Seed Correct Tenants

Seed:

- Fixer.guru as platform operator;
- KVARTAL Moscow partner organization;
- Apart4u.co partner organization;
- Future Yerevan partner placeholder;
- Future Dubai partner placeholder;
- partner sites/domains/themes.

### Step 6: Partner Site Engine

- Convert `C:\Dev\Apart4U\apart.html` into the first `partner-site` theme.
- Add tenant/domain resolution.
- Add placeholder inventory cards from `public-api` contract.

### Step 7: Partner Admin

- Add authenticated partner organization dashboard.
- Add object list scoped to active partner organization.
- Add lead list scoped to active partner site/organization.
- Add co-broker request list.

### Step 8: Platform Admin

- Add Fixer.guru dashboard.
- Add partner organization management.
- Add site/domain management.
- Add access plan/subscription placeholders.
- Add audit view.

### Step 9: API and Data Enforcement

- Implement tenant resolution middleware.
- Implement partner membership checks.
- Implement public inventory filter.
- Implement lead source attribution.
- Implement co-broker request creation.
- Implement audit logs for platform private access.

### Step 10: Deploy

- Create separate Firebase App Hosting backends.
- Deploy each app independently.
- Deploy `partner-api` and `public-api` to Cloud Run.
- Verify:
  - platform admin does not appear in public site;
  - partner admin resolves tenant correctly;
  - apart4u.co can show shared Moscow public objects;
  - lead from apart4u.co is attributed to Apart4u.co.

## 12. Acceptance Criteria

The architecture is correct only when:

- `apps/web` has no admin pages.
- `apps/platform-admin` is separate from partner admin.
- `apps/partner-admin` is tenant-scoped.
- `apps/partner-site` supports at least Apart4u.co as branded tenant.
- public inventory is read through public-safe rules.
- leads store source site and buyer-side organization.
- objects store seller-side/information-owner organization.
- partner organizations cannot see unrelated private data.
- Fixer.guru platform owner access is audited.
- monetization concepts exist in data model and docs.

## 13. Explicit Non-Goals For The Next Implementation Slice

Do not implement yet:

- payment processing;
- complete commission accounting;
- complete Telegram Mini App;
- complete AI intake UI;
- full legal document review workflow;
- public user accounts;
- separate repository split.

These are future modules after the app/API boundaries and tenant model are correct.
