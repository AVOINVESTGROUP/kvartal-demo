# KVARTAL Role and Access Schema Draft

**Date:** 2026-05-28  
**Status:** Approved baseline  
**Related:** `docs/00-MASTER-ARCHITECTURE.md`, `docs/02-DATA-MODEL.md`, `docs/03-API-CONTRACTS.md`

> Product terminology correction: see `docs/16-PARTNER-NETWORK-PLATFORM.md`. Fixer.guru is the platform owner/operator. KVARTAL Moscow, Apart4u.co Tbilisi, and future firms are partner organizations. Office roles remain valid only as branch/city-level roles inside partner organizations.

## 1. Purpose

This document describes the proposed role and access model for KVARTAL before Prisma schema and backend implementation.

The model must support:

- project owner/operator control through the `Fixer.guru` workspace and Google Cloud organization;
- multiple connected real estate firms in different countries;
- each firm having its own administrative structure;
- employees who may belong to one or more organizations/offices;
- public site users such as property owners and buyers/investors.

## 2. Top-Level Structure

```text
Platform Owner / Operator
  -> Platform Organization: Fixer.guru
  -> Google Cloud / Workspace / Billing / Infrastructure
  -> KVARTAL Platform
    -> Connected Organization: KVARTAL Moscow
      -> Moscow office
      -> Moscow employees
      -> Moscow objects, leads, deals
    -> Connected Organization: Apart4u.co Tbilisi
      -> Tbilisi office
      -> Tbilisi employees
      -> Tbilisi objects, leads, deals
    -> Connected Organization: future partner firms
      -> local offices
      -> local employees
      -> local objects, leads, deals
    -> Public Site Users
      -> property owners
      -> buyers / tenants / investors
```

## 3. Entity Types

### Platform Operator

The platform operator is the owner of the technology platform and infrastructure.

Initial operator:

```text
Fixer.guru
```

Controls:

- Google Cloud organization/workspace;
- Firebase/App Hosting;
- Cloud Run services;
- Cloud SQL/PostgreSQL;
- Secret Manager;
- billing and infrastructure;
- platform-wide access;
- connected organizations;
- global settings;
- platform subscriptions and monetization;
- audit and moderation policy.

### Connected Organization

A connected organization is a real estate firm, partner company, or operating entity using the platform.

Examples:

```text
KVARTAL Moscow
Apart4u.co Tbilisi
Future Yerevan partner
Future Dubai partner
```

Each connected organization may have:

- its own legal/public name;
- country of registration;
- operating countries;
- local administrative hierarchy;
- one or more offices/branches;
- local employees;
- local site/domain;
- own leads;
- own property records;
- own deal participation;
- subscription or commercial terms.

### Office / Branch

An office is a local operational unit inside an organization.

Examples:

```text
KVARTAL Moscow -> Moscow office
Apart4u.co -> Tbilisi office
Future partner -> Yerevan office
```

An office owns day-to-day operational work:

- adding objects;
- working with local leads;
- managing brokers;
- participating in inter-office deals;
- handling local clients;
- maintaining local website content.

### Public Site User

Public site users are not internal staff by default.

Possible public user types:

- property owner / seller / landlord;
- buyer / tenant / investor;
- partner introducer;
- anonymous visitor;
- registered client, if client accounts are added later.

Public users may submit requests, but they do not receive staff/admin access unless explicitly invited into an internal role.

## 4. Role Families

### Platform Roles

Platform roles belong to the platform operator layer and are enforced by `platform-api`.

| Role | Typical holder | Scope |
|---|---|---|
| `platform_owner` | Fixer.guru owner/operator | Full platform and infrastructure-level product control. |
| `platform_admin` | Trusted platform operator/admin | Manage connected organizations, offices, settings, moderation, subscriptions. |
| `platform_analyst` | Platform analyst/editor | Manage platform-level analytics and market insights. |
| `platform_viewer` | Auditor/advisor | Read-only platform visibility where allowed. |

Rules:

- `platform_owner` is the highest product role in the system.
- `platform_owner` has maximum platform authority over organizations, offices, users, subscriptions, moderation, and system policy.
- `platform_owner` may assign and revoke `platform_admin` and organization ownership.
- `platform_owner` access to private organization data, private leads, PII, or emergency/moderation actions must be recorded in `audit_logs`.
- Platform roles are global.
- Platform roles do not automatically grant employment in a connected organization.
- Platform emergency access to organization data must be audited.

### Organization Roles

Organization roles belong to one connected organization and are enforced by `office-api`.

| Role | Typical holder | Scope |
|---|---|---|
| `organization_owner` | Owner/director of KVARTAL Moscow, Apart4u.co, etc. | Full control inside one organization. |
| `organization_admin` | COO/admin manager of the firm | Manage users, offices, settings, and operations inside one organization, except owner-only actions. |

Rules:

- Organization roles apply across all offices of that organization.
- Organization roles do not grant platform access.
- Organization roles do not grant access to other organizations.

### Office Roles

Office roles belong to one office/branch and are enforced by `office-api`.

| Role | Typical holder | Scope |
|---|---|---|
| `office_owner` | Local office head | Full operational control inside one office. |
| `office_admin` | Office administrator | Manage local users, objects, leads, and operational settings. |
| `broker` | Broker/agent | Work with assigned or office-visible objects, leads, and deals. |
| `office_analyst` | Local analyst | Read office data and contribute office-scoped analytics/notes. |
| `office_viewer` | Assistant/auditor | Read-only office-scoped access. |

Rules:

- Office roles apply only to one office.
- Office roles do not grant access to the full organization unless paired with organization membership.
- Every office-scoped request must resolve `activeOrganizationId` and `activeOfficeId`.

### Public User Roles

Public roles are for external users and are not admin roles.

| Role | Typical holder | Scope |
|---|---|---|
| `public_visitor` | Anonymous website visitor | Read published public objects and public pages. |
| `property_owner` | Seller/landlord/owner submitting object or inquiry | Submit property/inquiry data; no admin access by default. |
| `buyer_investor` | Buyer, tenant, investor | Submit request, shortlist interest, receive deal-room invite later. |
| `client_contact` | Known client contact | Future authenticated client portal or deal room access. |

Rules:

- Public users are separate from staff users.
- Public users cannot access `platform-api`.
- Public users cannot access `office-api` admin endpoints.
- If client accounts are implemented later, they should use a separate client access model, not office staff roles.

## 5. Example Assignments

### Fixer.guru / Platform Operator

```text
organization: Fixer.guru
role: platform_owner
service access: platform-api
infrastructure access: Google Cloud / Workspace / Firebase / Cloud SQL
```

Can:

- create connected organizations;
- create/suspend offices;
- configure platform-wide settings;
- assign platform admins;
- inspect audit logs;
- moderate cross-organization disputes;
- manage subscriptions and limits.

### KVARTAL Moscow

```text
organization: KVARTAL Moscow
country: Russia
office: Moscow office
```

Possible users:

```text
Director -> organization_owner
Operations manager -> organization_admin
Office lead -> office_owner
Office admin -> office_admin
Broker -> broker
Analyst -> office_analyst
Assistant -> office_viewer
```

Can:

- manage Moscow office users;
- add and edit Moscow-owned objects;
- receive Moscow site leads;
- participate as seller-side office for Moscow-owned objects;
- participate as buyer-side office for Moscow-origin leads.

Cannot:

- manage Apart4u.co users;
- edit Apart4u.co private objects;
- access unrelated organization lead PII;
- change platform-wide settings.

### Apart4u.co Tbilisi

```text
organization: Apart4u.co
country: Georgia
office: Tbilisi office
```

Possible users:

```text
Founder/director -> organization_owner
Admin manager -> organization_admin
Broker -> broker
Viewer/assistant -> office_viewer
```

Can:

- manage Tbilisi office users;
- manage its own objects and leads;
- bring buyers/investors to Moscow objects;
- create co-broker requests to KVARTAL Moscow;
- participate as buyer-side office in inter-office deal rooms.

Cannot:

- edit KVARTAL Moscow primary object data;
- read Moscow private leads unless a deal/co-broker flow grants access;
- manage platform subscriptions except own organization view/policy if allowed.

## 6. Access Boundary Summary

| Layer | Example | Backend | Access Type |
|---|---|---|---|
| Platform | Fixer.guru operator | `platform-api` | Global platform control. |
| Organization | KVARTAL Moscow, Apart4u.co | `office-api` | Firm-level management. |
| Office | Moscow office, Tbilisi office | `office-api` | Local operational management. |
| Public user | owner, buyer, investor | `office-api` public endpoints | Intake and public reads only. |

## 7. Approval Questions

Resolved:

1. `platform_owner` is the maximum role and belongs to the project owner/operator.
2. `platform_owner` has global control, with audit required for private data and emergency/moderation access.

Still need owner approval:

1. Is `Fixer.guru` the platform operator entity in the product model?
2. Should `KVARTAL Moscow` and `Apart4u.co` be modeled as separate organizations from day one?
3. Should each organization start with exactly one office, or can Stage 3 seed multiple offices per organization?
4. Should `property_owner` and `buyer_investor` be stored as public/client roles now, or only as lead/contact types until client accounts exist?
5. Should organization owners be able to manage all offices inside their organization by default?
6. Should office brokers create objects by default, or only if office policy enables it?
7. Should public users ever authenticate in Stage 3, or remain form-submitters only?
