# API CONTRACTS

**Status:** active draft  
**Last updated:** 2026-05-28  
**Related:** `docs/02-DATA-MODEL.md`, `docs/11-STAGE-3-SSOT-ADMIN-PLAN.md`, `docs/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md`

## 1. Purpose

This document describes API and data access contracts for the KVARTAL multi-office platform.

Stage 3 uses two dedicated Cloud Run backend API boundaries over PostgreSQL. Contracts define the stable product boundary for the platform control plane and office/public operations.

## 2. API Principles

- Version: `v1`.
- Format: JSON.
- Auth: Firebase Auth JWT.
- Authorization: PostgreSQL-backed platform role, organization membership, office membership, object ownership, deal-room participation.
- Validation: schema-level validation before writes.
- Audit: privileged mutations should create audit log entries.
- SSOT: KVARTAL owns objects, leads, deal rooms, and office data.
- CRM integration is one-way outbound only if added later.
- Runtime: dedicated Cloud Run services, not Next.js route handlers.

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

Office operations and local public workflows.

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
```

Response:

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

## 6. Office Admin Endpoints

Office Admin is for connected firms.

### GET `/api/v1/admin/context`

Returns current user organization and office context.

Response:

```json
{
  "uid": "firebase_uid",
  "organizations": [
    {
      "organizationId": "org_moscow",
      "roles": ["organization_owner"]
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
  "platformRoles": []
}
```

### GET `/api/v1/admin/objects`

List objects visible to current office.

Query:

```text
officeId: string
status?: draft | published | archived
visibility?: private | office_network | public
```

Regular office users can list:

- objects owned by their office;
- network/public objects visible to their office.

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
  "propertyObjectId": "object_1",
  "fromOfficeId": "office_tbilisi",
  "toOfficeId": "office_moscow",
  "clientIntentId": "intent_1",
  "message": "Client is interested in this property."
}
```

Rules:

- `toOfficeId` must match `propertyObject.ownerOfficeId`;
- `fromOfficeId` must be current user's office;
- object must allow inter-office requests.

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
  "propertyObjectIds": ["object_1"],
  "sellerOfficeId": "office_moscow",
  "buyerOfficeId": "office_tbilisi"
}
```

Rules:

- seller office must own at least one selected object;
- buyer office must own the client intent or be approved participant;
- unrelated offices cannot create deal rooms.

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
- `apps/office-api` deployed to Cloud Run;
- shared Prisma/domain/auth packages used only on trusted backend sides.

Do not implement Stage 3 backend contracts as Next.js route handlers. Public and admin components should call the relevant Cloud Run API through a frontend repository/client layer.
