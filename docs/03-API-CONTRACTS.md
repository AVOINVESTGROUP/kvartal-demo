# API CONTRACTS

**Status:** active draft  
**Last updated:** 2026-05-28  
**Related:** `docs/00-MASTER-ARCHITECTURE.md`, `docs/02-DATA-MODEL.md`, `docs/16-PARTNER-NETWORK-PLATFORM.md`, `docs/17-PARTNER-NETWORK-IMPLEMENTATION-PLAN.md`

## 1. Purpose

This document describes API and data access contracts for the Fixer.guru-owned partner-network platform.

Stage 3 uses two dedicated Cloud Run backend API boundaries over PostgreSQL. Contracts define the stable product boundary for the platform control plane and office/public operations.

## 2. API Principles

- Version: `v1`.
- Format: JSON.
- Auth: Firebase Auth JWT.
- Authorization: PostgreSQL-backed platform role, organization membership, office membership, object ownership, deal-room participation.
- Validation: schema-level validation before writes.
- Audit: privileged mutations should create audit log entries.
- SSOT: PostgreSQL owns platform objects, leads, deal rooms, memberships, and site visibility state.
- Data rights: contributing organizations remain information rights holders for their private object/document data.
- CRM integration is one-way outbound only if added later.
- Runtime: dedicated Cloud Run services, not Next.js route handlers.
- Partner admin: one shared multi-tenant admin application; tenant context is resolved by backend auth context.

## 2.1 Backend Service Boundaries

### `platform-api`

Platform owner/operator control plane.

Owns:

- `/api/v1/platform/*`
- global office management;
- market and site configuration;
- subscription placeholders;
- platform analytics publishing;
- moderation workflows;
- audit inspection.

Access:

```text
platform_owner
platform_admin
platform_analyst where explicitly allowed
platform_viewer for read-only views where explicitly allowed
```

### `office-api`

Current service name for partner organization operations and local public workflows.

Target terminology is `partner-api` for organization admin workflows and `public-api` for public site reads/intake when the boundary is split. Until then, `office-api` must still enforce organization and office tenancy.

Owns:

- `/api/v1/public/*`
- `/api/v1/admin/*`
- public object reads;
- public client intent creation;
- office object management;
- office leads;
- co-broker requests;
- deal rooms where the office participates.

Access:

```text
public for published public reads and public intake
office_owner
office_admin
broker
office_analyst
office_viewer
```

The services may share schema/types, but authorization logic must remain service-specific.

## 2.2 RBAC Principles

- Platform roles and office roles are separate role families.
- Platform roles are global and checked by `platform-api`.
- Office roles are scoped to one office membership and checked by `office-api`.
- Organization roles are scoped to one organization membership and checked by `office-api`.
- Platform role does not automatically grant office membership.
- Organization/office role does not grant platform access.
- Office role does not grant organization-wide access unless paired with organization membership.
- `activeOfficeId` must belong to `activeOrganizationId`.
- A user may belong to multiple organizations in different countries; every protected request must resolve the intended organization/office context before authorization.
- Office-scoped requests must resolve exactly one `activeOfficeId`.
- Authorization must check role, resource ownership, and deal-room participation.
- Lead PII requires stricter permission than lead metadata.
- Platform emergency/moderation access must create audit logs.
- Public users can only read published public data and submit public client intents.

## 3. Auth Context

Every authenticated request should resolve:

```ts
type RequestAuthContext = {
  uid: string;
  email?: string;
  platformRoles: string[];
  organizationMemberships: Array<{
    organizationId: string;
    roles: string[];
    countryCodes?: string[];
  }>;
  officeMemberships: Array<{
    organizationId: string;
    officeId: string;
    roles: string[];
  }>;
  activeOrganizationId?: string;
  activeOfficeId?: string;
};
```

Authorization checks must use this context, not raw email checks.

## 4. Public Endpoints

### GET `/api/v1/public/objects`

Returns public published objects for a site/market.

Query:

```text
siteId?: string
marketId?: string
officeId?: string
assetClass?: string
language?: string
currency?: string
limit?: number
```

Rules:

```text
status == "published"
visibility == "public"
canBeShownByOtherOffices == true for cross-organization display
not hidden by SiteObjectVisibilityOverride for the requesting site organization
```

Localization rule:

```text
language query -> site default language -> organization third language -> en -> ru
```

Response:

Returned object text should be resolved to the requested language/fallback language before it is sent to public sites. Public clients should not have to merge localization records themselves.

```json
{
  "items": [
    {
      "id": "object_1",
      "ownerOfficeId": "office_moscow",
      "marketId": "market_moscow",
      "title": {"ru": "Складской комплекс"},
      "assetClass": "warehouse",
      "areaSqm": 1200,
      "price": {"mode": "on_request"},
      "imageUrls": ["/images/objects/example.jpg"]
    }
  ]
}
```

### GET `/api/v1/public/objects/{id}`

Returns one public object if published and public.

### POST `/api/v1/public/client-intents`

Creates a public client request from a local site.

Request:

```json
{
  "sourceWebsiteId": "site_tbilisi",
  "sourceOfficeId": "office_tbilisi",
  "marketId": "market_moscow",
  "preferredLanguage": "ru",
  "preferredCurrency": "USD",
  "clientName": "Client name",
  "clientContact": "+995...",
  "requirementText": "Interested in object object_1",
  "propertyObjectId": "object_1"
}
```

Response:

```json
{
  "clientIntentId": "intent_1",
  "status": "new"
}
```

If `propertyObjectId` belongs to another office, the system may create a draft `CoBrokerRequest` or prepare one for office review depending on policy.

## 5. Platform Admin Endpoints

Platform Admin is for the platform owner/operator.

### GET `/api/v1/platform/offices`

List connected offices.

Required role:

```text
platform_owner or platform_admin
```

### POST `/api/v1/platform/offices`

Create office.

Request:

```json
{
  "organizationId": "org_tbilisi",
  "slug": "tbilisi",
  "legalName": "Tbilisi Office LLC",
  "displayName": {"ru": "KVARTAL Тбилиси", "en": "KVARTAL Tbilisi"},
  "city": "Tbilisi",
  "country": "GE",
  "defaultMarketId": "market_tbilisi",
  "defaultLanguage": "ru",
  "supportedLanguages": ["ru", "en", "ka"],
  "defaultCurrency": "USD",
  "supportedCurrencies": ["USD", "GEL"]
}
```

### PATCH `/api/v1/platform/offices/{officeId}`

Update office status/settings.

### GET `/api/v1/platform/markets`

List markets.

### POST `/api/v1/platform/markets`

Create market.

### GET `/api/v1/platform/site-configs`

List site configs.

### POST `/api/v1/platform/site-configs`

Create site config for office website.

### GET `/api/v1/platform/subscriptions`

List office subscription states.

Stage 3 may return placeholders until billing is implemented.

## 6. Partner Admin Endpoints

Partner Admin is for connected partner organizations.

`apps/partner-admin` must be one shared multi-tenant app. The backend returns tenant context after Firebase Auth verification and PostgreSQL membership lookup.

### GET `/api/v1/admin/context`

Returns current user organization and office context.

Response:

```json
{
  "uid": "firebase_uid",
  "organizations": [
    {
      "organizationId": "org_moscow",
      "roles": ["organization_owner"],
      "supportedLanguages": ["ru", "en"],
      "thirdLanguage": null
    }
  ],
  "offices": [
    {
      "organizationId": "org_moscow",
      "officeId": "office_moscow",
      "roles": ["office_owner"]
    }
  ],
  "activeOrganizationId": "org_moscow",
  "activeOfficeId": "office_moscow",
  "platformRoles": [],
  "adminInterfaceLanguage": "ru"
}
```

### GET `/api/v1/admin/objects`

List objects visible to current office.

Query:

```text
officeId: string
status?: draft | published | archived
visibility?: private | office_network | public
includePartnerObjects?: boolean
```

Regular office users can list:

- objects owned by their office;
- network/public objects visible to their office.

Partner objects returned for site visibility management must include whether they are hidden for the active organization website.

### POST `/api/v1/admin/objects`

Create property object owned by current office.

Required:

```text
office_owner, office_admin, or broker for officeId
```

Server must set:

```text
ownerOrganizationId = current organization
ownerOfficeId = current office
rights.informationOwnerOrganizationId = current organization
rights.informationOwnerOfficeId = current office
createdByUserId = current uid
```

### AI-assisted object intake

Office users may create property drafts from unstructured data.

Endpoints:

```text
POST /api/v1/admin/property-intakes
GET /api/v1/admin/property-intakes/{id}
POST /api/v1/admin/property-intakes/{id}/extract
POST /api/v1/admin/property-intakes/{id}/verify
GET /api/v1/admin/property-ai-drafts/{draftId}
POST /api/v1/admin/property-ai-drafts/{draftId}/clarifications
POST /api/v1/admin/property-ai-drafts/{draftId}/approve
POST /api/v1/admin/property-ai-drafts/{draftId}/reject
```

Rules:

- AI creates draft data only.
- Human confirmation is required before canonical `property_objects` writes.
- Backend sets ownership fields from auth context.
- Backend validates draft data before save.
- AI extraction and approval/rejection events are audited.
- Open-source verification results must include source, checked date, result, and confidence.
- Open-source conflicts require human review before canonical writes.
- Verification output is supporting evidence, not a legal due-diligence conclusion.

### GET `/api/v1/admin/objects/{id}`

Read object if:

- owned by current office;
- visible to office network;
- public;
- or current user is platform admin.

### PATCH `/api/v1/admin/objects/{id}`

Update property object.

Rules:

- owner office can edit primary data;
- platform admin can edit/moderate with audit;
- other offices cannot edit primary data.

### POST `/api/v1/admin/objects/{id}/publish`

Publish object.

### POST `/api/v1/admin/objects/{id}/archive`

Archive object.

### GET `/api/v1/admin/site-object-visibility-overrides`

List object-level website visibility overrides for the active organization.

Query:

```text
propertyObjectId?: string
hidden?: boolean
```

Rules:

- organization owner/admin may read overrides for the active organization;
- platform admin may inspect with audit policy;
- overrides affect only the active organization's public site display.

### PUT `/api/v1/admin/site-object-visibility-overrides/{propertyObjectId}`

Hide or show one partner object on the active organization's public site.

Request:

```json
{
  "hidden": true
}
```

Rules:

- only active organization owner/admin can mutate its own site override;
- object owner organization cannot use this endpoint to unpublish globally;
- hiding an object here does not change `PropertyObject.status`, `PropertyObject.visibility`, or information ownership;
- every mutation should write an audit log.

### Legal document endpoints

Legal documents are handled by `office-api` for office/organization/deal workflows and by `platform-api` only for audited platform moderation/emergency access.

Draft office endpoints:

```text
GET /api/v1/admin/legal-documents
POST /api/v1/admin/legal-documents
GET /api/v1/admin/legal-documents/{id}
PATCH /api/v1/admin/legal-documents/{id}
POST /api/v1/admin/legal-documents/{id}/reviews
```

Rules:

- legal documents are private by default;
- access depends on document scope, confidentiality, active organization/office, and deal-room participation;
- platform access to private legal documents must be audited;
- review status is not a legal opinion by itself;
- expiry dates must be queryable for operational follow-up.

## 7. Client Intent and Co-Broker Endpoints

### GET `/api/v1/admin/client-intents`

List leads for current office.

Rules:

- source office can see full lead details;
- other offices see lead details only through accepted deal/co-broker flow;
- platform admin can inspect according to policy.

### POST `/api/v1/admin/cobroker-requests`

Create request from one office to another.

Request:

```json
{
  "partnerOfferId": "offer_1",
  "clientIntentId": "intent_1",
  "message": "Client is interested in this property."
}
```

Rules:

- `partnerOfferId` must identify an active, currently published offer;
- source organization, office and actor come only from authenticated `ActorContext`;
- target organization, office, representation and object come only from the offer and cannot be supplied or overridden by the caller;
- the client intent must belong to the authenticated buyer-side organization;
- the interaction stores immutable references to the offer and representation used at creation.

### PATCH `/api/v1/admin/cobroker-requests/{id}`

Accept, decline, expire, or close co-broker request.

Only participating offices and platform admins can mutate.

## 8. Deal Room Endpoints

### POST `/api/v1/admin/deal-rooms`

Create inter-office deal room.

Request:

```json
{
  "clientIntentId": "intent_1",
  "partnerInteractionId": "interaction_1"
}
```

Rules:

- seller organization and office are copied from the interaction's exact partner offer;
- buyer organization and office come from the authenticated actor and client intent;
- property, representation right, publication grant and partner offer are snapshotted into the Deal Room;
- buyer organization must own the client intent or be an explicit participant;
- unrelated offices cannot create deal rooms.

### Agency wallet and publication endpoints

```text
POST /api/v1/admin/corporate-wallets/challenge
POST /api/v1/admin/corporate-wallets/verify
GET  /api/v1/admin/corporate-wallets
POST /api/v1/admin/properties/{propertyObjectId}/representations
POST /api/v1/admin/representations/{representationRightId}/offers
POST /api/v1/admin/offers/{partnerOfferId}/publish
```

All organization and office scope is derived from `ActorContext`. Wallet verification uses a short-lived nonce-bound typed signature for the exact organization, address and BSC chain ID. Publication requires an active verified corporate wallet, documentary evidence, an attested representation right, uniqueness clearance and an active offer. It does not call a platform approval endpoint.

### Platform owner Web3 endpoints

Contract deployment/activation, signer health, token queue, reconciliation, disputes and suspensions are available only to the single database-bound `platform_owner` account `office@integrayachtsuae.com`. User-facing mutations never accept a static admin token and email lists never grant access.

### GET `/api/v1/admin/deal-rooms/{id}`

Read deal room if participating office or platform admin.

### PATCH `/api/v1/admin/deal-rooms/{id}`

Update status.

Allowed status flow:

```text
draft -> sent -> viewed -> active -> closed
draft -> archived
sent -> archived
active -> archived
```

### POST `/api/v1/admin/deal-rooms/{id}/events`

Append immutable event.

### GET `/api/v1/admin/deal-rooms/{id}/events`

List deal room events.

## 9. Analytics Endpoints

Analytics is mostly future scope, but contracts are reserved.

### GET `/api/v1/public/market-indicators`

Public published indicators.

### GET `/api/v1/public/market-insights`

Public published insights.

### POST `/api/v1/platform/market-indicators`

Create/update indicator.

Required role:

```text
platform_admin or platform_analyst
```

### POST `/api/v1/platform/market-insights`

Create/update insight.

Rules:

- must include source;
- must include confidence;
- must not promise guaranteed returns.

## 10. Error Format

All API errors should use:

```json
{
  "error": {
    "code": "forbidden",
    "message": "You cannot edit an object owned by another office.",
    "details": {}
  }
}
```

Common codes:

- `bad_request`
- `unauthenticated`
- `forbidden`
- `not_found`
- `conflict`
- `validation_failed`
- `unsupported`
- `internal`

HTTP mapping:

- `400` bad request
- `401` unauthenticated
- `403` forbidden
- `404` not found
- `409` conflict
- `422` validation failed
- `500` internal

## 11. Stage 3 Implementation Note

Stage 3 may implement these contracts as:

- `apps/platform-api` deployed to Cloud Run;
- current `apps/office-api` deployed to Cloud Run, with target terminology moving toward `partner-api` / `public-api`;
- shared Prisma/domain/auth packages used only on trusted backend sides.

Do not implement Stage 3 backend contracts as Next.js route handlers. Public and admin components should call the relevant Cloud Run API through a frontend repository/client layer.
# Auth and external identity API — Increment 1A

All `/api/v1/platform/external-identity-*` resources require a verified Firebase session actor with the active `platform_owner` role. Shared legacy admin tokens cannot authenticate these routes. Mutations require `Idempotency-Key` and `If-Match: "<rowVersion>"`; responses return `ETag`.

Resources:

- binding requests: create/list/detail/events, select candidate, create narrow candidate user, approve, reject and cancel;
- identities: list/detail/events, revoke and create reactivation request;
- candidate lookup: read-only `AppUser` search;
- actor context: `/api/v1/platform/actor-context` and `/api/v1/admin/actor-context`.

BFF session endpoints are `GET /api/auth/csrf`, `POST /api/auth/firebase/session` and `POST /api/auth/logout`. Session creation/logout require exact configured `Origin` plus the `__Host-kvartal_csrf` double-submit token. The Firebase session cookie is `__Host-kvartal_session`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, five days.

Cloud Run transport is exactly:

```http
X-Serverless-Authorization: Bearer <Google service ID token>
Authorization: Bearer <Firebase session-cookie JWT>
```

Errors use `{ "error": { "code", "message", "correlationId" } }` and public-safe messages.
