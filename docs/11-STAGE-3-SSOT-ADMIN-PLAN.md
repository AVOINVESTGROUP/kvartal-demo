# Stage 3: Multi-Office SSOT Foundation Plan

**Date:** 2026-05-28  
**Status:** Draft for approval  
**Project:** KVARTAL Multi-Office Real Estate Platform  
**Primary reference:** `docs/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md`

## 1. Purpose

Stage 3 is no longer a simple "admin panel for one company".

Stage 3 must create the foundation for a developer-owned multi-office real estate platform:

```text
Platform Admin
-> Offices
-> Local Sites
-> Shared Property SSOT
-> Client Intents
-> Inter-Office Deal Rooms
```

The goal is to prepare the data, access model, and first admin surfaces so that Moscow, Tbilisi, Yerevan, and future offices can work with one shared database while preserving ownership of contributed property information.

## 2. Current Project State

Completed:

- Next.js app exists in `apps/web`.
- Firebase App Hosting backend exists: `kvartal-web-dev`.
- Deployment is connected to GitHub `main`; Firebase rollout is triggered by Git push.
- Public website has real KVARTAL company contacts.
- Public object cards currently exist in frontend code.
- Multi-office architecture is documented in `docs/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md`.

Not yet implemented:

- Firestore SSOT.
- Firebase Auth based admin access.
- Platform Admin.
- Office Admin.
- Office/user role model.
- Object ownership rules.
- Leads and inter-office deal rooms.
- Storage upload flow.
- Security rules.

## 3. Stage 3 Product Goal

Create a working technical foundation where:

```text
Platform owner manages connected offices.
Each office can own and manage its own property data.
Published objects can appear in the shared storefront.
Client requests belong to the source office.
Inter-office deal rooms can later connect buyer-side and seller-side offices.
```

Stage 3 should not try to build the full brokerage network. It must create the correct base so future stages do not require architectural rework.

## 4. Non-Negotiable Architecture Rules

- Shared property database is the SSOT.
- The object contributor remains the information rights holder.
- Only the owner office can edit primary object data.
- Leads belong to the source office/site.
- Platform Admin and Office Admin are separate concepts.
- Multilingual and multicurrency structures must be prepared now.
- Monetization is not implemented now, but subscription/feature placeholders must exist.
- Public analytics is not implemented now, but market indicator placeholders must exist.
- CRM is not object SSOT.
- No deploy or rollout except through approved Git push.
- Root `index.html` remains untouched.

## 5. Stage 3 Scope

### Included

- Firestore-based MVP SSOT.
- Firebase Auth foundation.
- Role and office membership model.
- Seed offices: Moscow, Tbilisi, Yerevan.
- Seed markets: Moscow, Tbilisi, Yerevan.
- Shared TypeScript domain types.
- `PropertyObject` with ownership fields.
- `ClientIntent` with source office fields.
- `CoBrokerRequest` draft model.
- `InterOfficeDealRoom` draft model.
- Platform Admin shell.
- Office Admin shell.
- Object list/create/edit foundation for Office Admin.
- Public object read path prepared for Firestore.
- Image/document storage model prepared.
- Security rules draft.
- Local verification.
- Documentation updates.

### Excluded

- Real billing/payment processing.
- Full subscription UI.
- Full public analytics dashboard.
- Full Telegram Mini App.
- AI/Gemini qualification.
- CRM integration.
- Production data migration without explicit approval.
- Multi-domain production routing beyond configuration placeholders.

## 6. MVP Database Decision

Recommended Stage 3 decision:

```text
Use Firestore for MVP SSOT.
```

Reasons:

- Project already uses Firebase/App Hosting.
- Auth and security rules fit the MVP.
- Firestore is enough for initial office/object/lead/deal-room data.
- Future analytics can be mirrored into BigQuery.
- Cloud SQL/PostgreSQL can be introduced later if reporting and joins become heavy.

## 7. Core Collections

Recommended Firestore collections:

```text
offices
markets
users
officeUsers
siteConfigs
propertyObjects
clientIntents
coBrokerRequests
dealRooms
dealRoomEvents
subscriptionPlans
officeSubscriptions
currencyRateSnapshots
marketIndicators
marketInsights
auditLogs
```

Stage 3 implementation can start with a smaller physical subset:

```text
offices
markets
officeUsers
siteConfigs
propertyObjects
clientIntents
coBrokerRequests
dealRooms
auditLogs
```

The rest can be typed and documented without UI.

## 8. Required Domain Types

Create shared domain types in the web app first, then extract to a shared package later if needed.

Recommended initial location:

```text
apps/web/src/lib/domain/
```

Types:

- `LocalizedText`
- `CurrencyCode`
- `MoneyValue`
- `Price`
- `Office`
- `Market`
- `OfficeUser`
- `SiteConfig`
- `PropertyObject`
- `ClientIntent`
- `CoBrokerRequest`
- `InterOfficeDealRoom`
- `AuditLogEntry`

## 9. Access Model

Initial roles:

```text
platform_owner
platform_admin
office_owner
office_admin
broker
analyst
viewer
```

Permission principle:

```text
Platform Admin can manage the platform.
Office Admin can manage only its office data.
Broker can work only inside assigned office permissions.
Public users can read only published public objects.
```

Object ownership rule:

```text
propertyObjects.ownerOfficeId == current user's officeId
```

is required for regular office edits.

Platform admins may edit or moderate across offices, but every such action must create an audit log entry.

## 10. Admin Surfaces

### Platform Admin

Route group:

```text
/platform
```

Stage 3 shell routes:

```text
/platform
/platform/offices
/platform/markets
/platform/site-configs
/platform/subscriptions
```

Stage 3 Platform Admin capabilities:

- view connected offices;
- create/edit office basics;
- set office status;
- view markets;
- view site configs;
- see placeholder subscription state.

### Office Admin

Route group:

```text
/admin
```

Stage 3 shell routes:

```text
/admin
/admin/objects
/admin/objects/new
/admin/objects/[id]
/admin/leads
/admin/deals
/admin/settings
```

Stage 3 Office Admin capabilities:

- view own office context;
- list own property objects;
- create property object;
- edit owned property object;
- publish/archive owned property object;
- view leads placeholder;
- view inter-office deal placeholder.

## 11. Public Website Changes

Current public object section exists in:

```text
apps/web/src/components/Objects.tsx
```

Stage 3 target:

- keep the approved visual direction;
- move object data behind a domain/repository layer;
- support Firestore read path for published public objects;
- keep local fallback/seed data for development if Firestore is not configured;
- do not expose draft/private/network-only objects publicly.

Public object query rule:

```text
status == "published"
visibility == "public"
```

## 12. Seed Data

Seed data should include:

### Offices

- Moscow office
- Tbilisi office
- Yerevan office

### Markets

- Moscow / Russia
- Tbilisi / Georgia
- Yerevan / Armenia

### Current Objects

The currently displayed objects should be converted into seed `propertyObjects` with:

- `ownerOfficeId = moscow`
- `marketId` based on object location
- `status = published`
- `visibility = public`
- `price.mode = on_request`
- localized Russian text
- original image URLs

Important: seed data is not final CRM-style truth. It is an initial database bootstrap that prepares the SSOT pattern.

## 13. Security Rules Draft

Firestore rules must enforce:

- public users can read only public published objects;
- authenticated users can read their own office membership;
- office users can read objects visible to their office;
- office admins/brokers can write only objects owned by their office;
- platform admins can manage all offices and objects;
- leads are visible only to source office and approved deal-room participants;
- every privileged mutation should be mirrored in `auditLogs`.

Storage rules must enforce:

- public reads only for published public object media;
- writes only by authenticated users with valid office/platform role;
- object media paths include `ownerOfficeId` and `propertyObjectId`.

## 14. Implementation Sequence

### Step 1: Documentation Alignment

- Replace old single-company Stage 3 plan.
- Update `docs/02-DATA-MODEL.md`.
- Update `docs/03-API-CONTRACTS.md`.
- Update `docs/CURRENT_STATE.md`.

### Step 2: Domain Types

- Add domain types under `apps/web/src/lib/domain`.
- Add seed constants for offices, markets, and current public objects.
- Keep types framework-independent.

### Step 3: Firebase Setup

- Add Firebase client SDK.
- Add `.env.local.example`.
- Add config helper for client-side Firebase.
- Decide whether server-side Firebase Admin SDK is needed in Stage 3.

### Step 4: Data Repository Layer

- Add object repository abstraction.
- Add Firestore implementation.
- Add local fallback implementation for development.
- Public page reads via repository, not hardcoded component array.

### Step 5: Auth Foundation

- Add Firebase Auth login route.
- Add session/auth guard pattern.
- Add office membership lookup.

### Step 6: Admin Shells

- Create `/platform` protected shell.
- Create `/admin` protected shell.
- Add navigation and role-aware access checks.

### Step 7: Office Object CRUD

- List office-owned objects.
- Create object.
- Edit object.
- Publish/archive object.
- Prepare media upload placeholders.

### Step 8: Seeds and Migration

- Add seed script or admin-only seed action.
- Seed initial offices, markets, site configs, and current objects.
- Do not run production seed without approval.

### Step 9: Security Rules

- Add Firestore rules draft.
- Add Storage rules draft.
- Validate read/write assumptions locally where possible.

### Step 10: Verification

Run:

```powershell
pnpm --filter web lint
pnpm --filter web build
```

Manual checks:

- `/` renders public objects.
- `/platform` requires auth.
- `/admin` requires auth.
- office user cannot edit another office object.
- public user cannot read draft object.
- published public object appears.
- no secrets are committed.

## 15. Deployment Method

Deployment is Git-driven:

```text
commit -> push to main -> Firebase App Hosting rollout
```

Do not use Firebase CLI deploy for App Hosting unless explicitly requested.

Before push:

- lint passes;
- build passes;
- staged files reviewed;
- no `.env.local`;
- no cache/log files;
- no accidental screenshots.

## 16. Open Decisions Before Coding

Need owner approval:

1. Firestore confirmed as Stage 3 MVP database.
2. Firebase Auth confirmed for Platform Admin and Office Admin.
3. First platform admin user creation method: Firebase Console or seed script.
4. Initial office names and legal/public names.
5. Initial domains: single domain now or multi-domain config only.
6. Initial languages: `ru` only, or `ru` + `en`.
7. Initial currencies: `RUB` + `USD`, or include `GEL` and `AMD` immediately.
8. Whether current public object records should be seeded automatically or entered through Office Admin.
9. Whether `/platform` should be a real UI in Stage 3 or a protected shell with simple lists.
10. Whether media upload is required in Stage 3 or can be a typed placeholder until Stage 3B.

## 17. Recommended Stage 3A Deliverable

First implementation slice should be small and safe:

```text
Stage 3A: Domain Types + Seed Data + Public Repository Layer
```

Files likely affected:

- `apps/web/src/lib/domain/*`
- `apps/web/src/lib/data/*`
- `apps/web/src/components/Objects.tsx`
- `.env.local.example`
- `docs/CURRENT_STATE.md`

Acceptance:

- public object section uses typed seed/repository data;
- ownership fields exist in data;
- offices/markets exist as seed constants;
- lint/build pass;
- no Firebase production writes yet.

After Stage 3A approval, continue to:

```text
Stage 3B: Firebase Auth + Admin Shells
Stage 3C: Firestore Object CRUD
Stage 3D: Security Rules + Seed Script
```
