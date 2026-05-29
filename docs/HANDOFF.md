# Project Handoff

**Status:** active continuation note  
**Date:** 2026-05-29  
**Primary SSOT:** [`docs/00-MASTER-ARCHITECTURE.md`](00-MASTER-ARCHITECTURE.md)

This file captures the current working understanding so the project owner or another agent can continue without reconstructing context from chat.

## 1. Current Architecture Decision

The correct architecture is a multi-tenant platform, not separate duplicated admin applications for every partner organization.

Fixer.guru is the platform owner/operator. Partner organizations such as KVARTAL, Apart4u, Dubai, Yerevan, and future partners use the same platform infrastructure with rights-based access to their own data and allowed shared inventory.

The important rule:

- one platform admin for Fixer.guru;
- one shared partner admin for all partner organizations;
- separate branded partner websites where needed;
- one common database and API layer;
- data access controlled by organization, office, role, and object-level publication/visibility rules.

## 2. Applications

### Platform Admin

`apps/platform-admin`

Used by Fixer.guru only.

Responsibilities:

- create and manage partner organizations;
- assign and remove organization owners;
- assign and remove Fixer.guru team members;
- change roles and access;
- configure organization languages;
- configure connected websites;
- see and govern the full platform database;
- audit access and visibility.

### Partner Admin

`apps/partner-admin`

This must be one shared multi-tenant admin application for all partner organizations. Do not create a separate admin app per organization.

When a user logs in with Google, the backend must resolve:

- user identity;
- organization membership;
- role;
- office access;
- object permissions;
- access to own private objects;
- access to shared public inventory;
- object-level hidden/visible settings for the organization's own public website.

The partner admin UI can be the same for KVARTAL, Apart4u, Dubai, Yerevan, and future organizations. The data and available actions change by permissions.

### Partner Sites

Partner sites may be separate branded frontends:

- `apps/sites/kvartal`
- `apps/sites/apart4u`
- `apps/sites/dubai`
- `apps/sites/yerevan`

They should share common packages for public inventory, API client, property cards, i18n, and reusable UI logic. The brand shell can differ, but the platform logic must not be copied by hand.

## 3. Multi-Tenant Admin Rule

Do not duplicate partner-admin code for each organization.

The same partner-admin deployment should support many organizations. The logged-in user determines the tenant context.

Correct model:

```txt
Google login
  -> Firebase Auth identity
  -> backend verifies ID token
  -> backend finds User
  -> backend finds active OrganizationMembership
  -> backend applies role and permissions
  -> UI receives scoped organization context
```

Wrong model:

```txt
KVARTAL admin app
Apart4u admin app
Dubai admin app
Yerevan admin app
```

That model would make future updates expensive and inconsistent.

## 4. Language Model

The admin interface itself should stay Russian for now.

Property cards must be multilingual as data, not as separate frontend code.

Every organization has:

- required `ru`;
- required `en`;
- one configurable third language.

Examples:

- Apart4u: `ka`;
- Dubai: `ar`;
- Yerevan: `hy`;
- another organization can choose a different third language later.

Property text fields should be stored as translations, not duplicated objects.

Recommended relational model:

```txt
Property
  id
  organizationId
  officeId
  country
  city
  type
  price
  area
  status
  visibility

PropertyTranslation
  propertyId
  locale
  title
  description
  addressText
  publicNotes
```

The partner-admin object editor should show language tabs:

```txt
[RU] [EN] [ORG THIRD LANGUAGE]
```

Fallback for public websites:

```txt
requested locale -> organization third locale -> en -> ru
```

## 5. Shared Public Inventory

Shared Public Inventory means the common pool of objects approved for public display across partner websites.

Important distinction:

- object owner organization controls its own object data and publication into the shared pool;
- each website-owning organization can hide individual partner objects from its own website;
- hiding an object on one partner website must not unpublish it globally;
- Fixer.guru can see and govern everything.

The partner admin must allow object-level visibility control for partner objects shown on the organization's own site.

## 6. Data Rights

Data must be structured by legal/information rights holder.

Example:

- KVARTAL Moscow owns and controls its private Moscow object data;
- Apart4u controls its own Tbilisi organization data;
- other organizations cannot access private data unless explicitly granted;
- Fixer.guru, as platform owner/operator, has maximum administrative access;
- public data in the shared inventory is visible only to the extent approved for publication.

Do not confuse:

- owner of platform;
- partner organization;
- office/branch;
- object seller-side representative;
- information rights holder;
- public website displaying the object.

## 7. Next Work To Do

Recommended next implementation sequence:

1. Update `docs/00-MASTER-ARCHITECTURE.md` with an explicit "Shared Partner Admin / Multi-Tenant Admin Model" section.
2. Update `docs/02-DATA-MODEL.md` to add or confirm multilingual property translations and website-level object visibility overrides.
3. Update Prisma schema and migrations if the current schema does not already support:
   - organization configurable third language;
   - property translations;
   - per-site/per-organization hidden partner objects;
   - user memberships and roles;
   - legal document metadata.
4. Refactor `apps/partner-admin` if needed so it is clearly shared and tenant-scoped by backend identity.
5. Build Apart4u site by reusing the KVARTAL platform modules, replacing only the brand/front design and adding third language `ka`.
6. Keep all fixes and hard-won deployment/auth lessons in:
   - [`docs/FIREBASE_APP_HOSTING_TROUBLESHOOTING.md`](FIREBASE_APP_HOSTING_TROUBLESHOOTING.md)
   - [`docs/AGENT_MISTAKES_LOG.md`](AGENT_MISTAKES_LOG.md)

## 8. Agent Warnings

Do not:

- create separate partner admin applications per organization;
- duplicate business logic into every partner site;
- treat partner websites as separate products;
- hardcode organization access in frontend only;
- hardcode only two languages into property cards;
- claim broken encoding without verifying the actual file in UTF-8;
- simplify Cloud Run / PostgreSQL / Prisma / Firebase Auth architecture into temporary MVP shortcuts.

Do:

- preserve one platform database;
- preserve backend-enforced access control;
- keep partner-admin multi-tenant;
- keep partner sites brand-specific but factory-driven;
- use the master architecture as the first document to read;
- record recurring issues in the troubleshooting and mistakes logs.

## 9. Current Pause Point

The user is pausing to think about whether the admin/site architecture is correct.

The current conclusion is:

The architecture should not be rewritten into separate admin apps. It should be clarified and reinforced around one shared multi-tenant `partner-admin`, plus separate branded partner sites using shared modules.

