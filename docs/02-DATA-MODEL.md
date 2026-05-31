# DATA MODEL

**Status:** active draft  
**Last updated:** 2026-05-28  
**Related:** `docs/00-MASTER-ARCHITECTURE.md`, `docs/16-PARTNER-NETWORK-PLATFORM.md`, `docs/17-PARTNER-NETWORK-IMPLEMENTATION-PLAN.md`, `docs/adr/0001-postgresql-mvp-ssot.md`

> Product terminology correction: see `docs/16-PARTNER-NETWORK-PLATFORM.md`. The model is a Fixer.guru-owned partner network platform. Organizations such as KVARTAL Moscow and Apart4u.co are partner organizations. Offices are branches inside partner organizations. Future model updates should add partner sites, shared inventory grants, lead source sites, commission agreements, and platform monetization entities.

## 1. Purpose

This document defines the core data model for the Fixer.guru-owned partner-network real estate platform.

The model must support:

- multiple independent organizations/legal entities;
- one or more offices/branches inside each organization;
- organization-specific administrative structures;
- separate local websites;
- one shared property SSOT;
- object information ownership;
- legal documents for property objects and transactions;
- office-owned leads;
- inter-office deal rooms;
- multilingual content;
- multicurrency prices;
- future subscriptions and monetization;
- future public market analytics.

## 2. SSOT Boundary

KVARTAL backend is the source of truth for:

- `Office`
- `Organization`
- `Market`
- `PropertyObject`
- `ClientIntent`
- `CoBrokerRequest`
- `InterOfficeDealRoom`
- `DealRoomEvent`
- `MarketIndicator`
- `MarketInsight`

CRM may receive leads or deal updates later, but CRM must not become the source of truth for property objects.

## 3. Core Principles

- Every property object has an owner office.
- The office that enters an object remains the information rights holder.
- Leads belong to the source office/site.
- Deal rooms connect sides without transferring data ownership.
- Public users can see only published public objects.
- Draft/private/network objects are not public.
- Every critical change should be auditable.
- Legal documents must have scoped access, review status, and audit trail.
- Investment claims require source, date, and confidence.
- AI may draft property records from unstructured data, but confirmed SSOT writes require human review and backend validation.
- AI/open-source checks may support актуальность and plausibility verification, but they do not replace legal due diligence.
- Partner admin is a shared multi-tenant application; tenant access is resolved from user memberships and roles.
- Public property text must be stored as localization records, not as duplicated objects or duplicated frontend code.
- A partner organization may hide individual partner objects from its own public site without changing the canonical object publication state.

## 4. Common Types

```ts
type LanguageCode = "ru" | "en" | "ka" | "hy" | "ar";

type CurrencyCode = "RUB" | "USD" | "EUR" | "GEL" | "AMD" | "AED";

type LocalizedText = {
  ru?: string;
  en?: string;
  ka?: string;
  hy?: string;
  ar?: string;
};

type MoneyValue = {
  amount: number;
  currency: CurrencyCode;
};

type Price = {
  mode: "on_request" | "fixed" | "range";
  primary?: MoneyValue;
  min?: MoneyValue;
  max?: MoneyValue;
  displayOverride?: LocalizedText;
};
```

## 5. Organization

Represents an independent connected company, legal entity, partner network, or operating group.

An organization may have one or more offices/branches in one or more countries.

```ts
type Organization = {
  id: string;
  slug: string;
  legalName: string;
  displayName: LocalizedText;
  countryOfRegistration: string;
  operatingCountryCodes: string[];
  defaultLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  thirdLanguage?: LanguageCode;
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  status: "draft" | "active" | "suspended" | "archived";
  subscriptionPlanId?: string;
  createdAt: string;
  updatedAt: string;
};
```

Initial organizations may map 1:1 to the first offices, but the schema must not assume that permanently.

Language rule:

```text
supportedLanguages must include ru and en.
thirdLanguage is the organization-specific public language where configured.
```

## 6. Office

Represents a local office, branch, or city operation that belongs to an organization.

```ts
type Office = {
  id: string;
  organizationId: string;
  slug: string;
  legalName: string;
  displayName: LocalizedText;
  city: string;
  country: string;
  defaultMarketId: string;
  defaultLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  status: "draft" | "active" | "suspended" | "archived";
  websiteConfigId?: string;
  createdAt: string;
  updatedAt: string;
};
```

Initial offices:

- `office_moscow`
- `office_tbilisi`
- `office_yerevan`

## 7. Market

Represents a geographic and regulatory market.

```ts
type Market = {
  id: string;
  slug: string;
  city: string;
  country: string;
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  supportedLanguages: LanguageCode[];
  assetClasses: string[];
  complianceRegion: "RU" | "GE" | "AM" | "UAE" | "OTHER";
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Initial markets:

- Moscow / Russia
- Tbilisi / Georgia
- Yerevan / Armenia

## 8. User, Organization Membership, and Office Membership

Firebase Auth may own authentication identity. PostgreSQL owns platform roles, organization membership, and office membership.

```ts
type PlatformRole =
  | "platform_owner"
  | "platform_admin"
  | "platform_analyst"
  | "platform_viewer";

type OrganizationRole =
  | "organization_owner"
  | "organization_admin";

type OfficeRole =
  | "office_owner"
  | "office_admin"
  | "broker"
  | "office_analyst"
  | "office_viewer";

type AppUser = {
  uid: string;
  email: string;
  displayName?: string;
  platformRoles: PlatformRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type OrganizationMembership = {
  id: string;
  organizationId: string;
  uid: string;
  roles: OrganizationRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type OfficeMembership = {
  id: string;
  organizationId: string;
  officeId: string;
  uid: string;
  roles: OfficeRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Role rules:

- Platform roles are global and are enforced by `platform-api`.
- Organization roles are scoped to one organization and are enforced by `office-api`.
- Office roles are scoped to exactly one office membership and are enforced by `office-api`.
- Platform role does not automatically create office membership.
- Organization/office role does not grant platform access.
- Any request with office-scoped permissions must resolve one `activeOfficeId`.
- Any request with organization-scoped permissions must resolve one `activeOrganizationId`.
- Lead PII access must be checked separately from generic lead access.

## 9. SiteConfig

Represents a local office website configuration.

```ts
type SiteConfig = {
  id: string;
  organizationId: string;
  officeId: string;
  domain?: string;
  subdomain?: string;
  defaultLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  primaryMarketIds: string[];
  brandName: LocalizedText;
  showPartnerObjects: boolean;
  contactEmail?: string;
  contactPhone?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### Site Object Visibility Override

Represents a website-owning organization's decision to hide one eligible partner object from its own public site.

This does not unpublish the object globally and does not edit the owner organization's primary object data.

```ts
type SiteObjectVisibilityOverride = {
  id: string;
  organizationId: string;
  propertyObjectId: string;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};
```

## 10. PropertyObject

Represents a real property object in the shared database.

The property database must support simple real estate objects first, but must not be limited to apartments/houses.

Stage 3 minimum asset classes:

- `land`
- `apartment`
- `house`

The schema must be expandable to:

- warehouses and industrial bases;
- factories and production complexes;
- mixed-use sites;
- hotels and commercial buildings;
- development projects;
- investment projects;
- multi-component property/economic structures.

```ts
type AssetClass =
  | "land"
  | "apartment"
  | "house"
  | "warehouse"
  | "industrial_site"
  | "factory"
  | "hotel"
  | "office"
  | "retail"
  | "mixed_use"
  | "development_project"
  | "investment_project"
  | "other";

type PropertyObject = {
  id: string;
  ownerOrganizationId: string;
  ownerOfficeId: string;
  createdByUserId: string;
  marketId: string;

  status: "draft" | "published" | "archived";
  visibility: "private" | "office_network" | "public";

  addressPrivate?: string;

  assetClass: AssetClass;
  assetSubtype?: string;

  areaSqm?: number;
  landAreaSqm?: number;
  buildingAreaSqm?: number;
  rentableAreaSqm?: number;
  floorNumber?: number;
  floorsTotal?: number;
  roomsCount?: number;
  bedroomsCount?: number;
  bathroomsCount?: number;
  cadastralNumber?: string;
  price: Price;

  imageUrls: string[];
  documentRefs?: string[];
  localizations: PropertyObjectLocalization[];

  representation: {
    side: "owner" | "seller" | "landlord" | "originator";
    exclusivity?: "exclusive" | "non_exclusive" | "unknown";
  };

  rights: {
    informationOwnerOrganizationId: string;
    informationOwnerOfficeId: string;
    canBeShownByOtherOffices: boolean;
    requiresOwnerOfficeApprovalForLead: boolean;
  };

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};
```

Public text fields for property cards live in localization records:

```ts
type PropertyObjectLocalization = {
  id: string;
  propertyObjectId: string;
  language: LanguageCode;
  title: string;
  description?: string;
  addressDisplay: string;
  tags: string[];
  priceDisplay?: string;
  createdAt: string;
  updatedAt: string;
};
```

Partner admin should edit property public text through language tabs:

```text
[RU] [EN] [ORG THIRD LANGUAGE]
```

Fallback rule for public sites:

```text
requested language -> organization third language -> en -> ru
```

### Property Extension Model

The core `PropertyObject` should contain only fields shared by most objects. Specialized details should live in related tables so the model can grow without repeatedly changing the core table.

Recommended extension tables:

```text
property_object_components
property_object_attributes
property_object_economics
property_object_legal_details
property_object_utilities
property_object_transport_access
property_object_development_params
property_object_operations
```

### Property Components

Use components for multi-part assets such as factories, bases, mixed-use sites, or investment projects.

Examples:

```text
Factory object
  -> land plot
  -> production building
  -> warehouse
  -> office/admin building
  -> utility infrastructure

Investment project
  -> land
  -> permitted development volume
  -> construction stage
  -> projected revenue model
```

```ts
type PropertyObjectComponent = {
  id: string;
  propertyObjectId: string;
  componentType:
    | "land_plot"
    | "building"
    | "apartment_unit"
    | "house"
    | "warehouse"
    | "production_facility"
    | "office_block"
    | "retail_unit"
    | "utility_infrastructure"
    | "development_phase"
    | "economic_unit"
    | "other";
  title: LocalizedText;
  description?: LocalizedText;
  areaSqm?: number;
  landAreaSqm?: number;
  cadastralNumber?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
```

### Property Attributes

Use attributes for flexible characteristics that vary by asset class.

Examples:

```text
land:
  permitted_use
  land_category
  road_access
  utilities_available

apartment:
  rooms_count
  floor_number
  finishing
  building_year

factory:
  power_capacity_kw
  ceiling_height_m
  crane_capacity_t
  gas_available
  rail_access
```

```ts
type PropertyObjectAttribute = {
  id: string;
  propertyObjectId: string;
  componentId?: string;
  key: string;
  valueText?: LocalizedText;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  unit?: string;
  group?: string;
  public: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### Property Economics

Use economics for investment/project/business indicators.

```ts
type PropertyObjectEconomics = {
  id: string;
  propertyObjectId: string;
  price?: Price;
  rentalIncomeMonthly?: MoneyValue;
  operatingExpensesMonthly?: MoneyValue;
  noiAnnual?: MoneyValue;
  capRatePercent?: number;
  paybackYears?: number;
  occupancyPercent?: number;
  projectedRevenue?: MoneyValue;
  projectedCost?: MoneyValue;
  source?: string;
  confidence?: "high" | "medium" | "low" | "unsupported";
  createdAt: string;
  updatedAt: string;
};
```

Investment/economic fields must include source/confidence when used publicly. No guaranteed return claims.

### AI Property Intake

Object creation should support AI-assisted extraction from unstructured user-provided data.

AI-created data is a draft until a human office user confirms it.

Recommended tables:

```text
property_intake_submissions
property_ai_drafts
property_ai_extraction_events
property_ai_external_checks
```

```ts
type PropertyIntakeSubmission = {
  id: string;
  organizationId: string;
  officeId: string;
  createdByUserId: string;
  sourceType: "text" | "file" | "mixed";
  rawText?: string;
  fileRefs?: string[];
  status: "received" | "extracting" | "needs_clarification" | "draft_ready" | "confirmed" | "rejected";
  createdAt: string;
  updatedAt: string;
};

type PropertyAIDraft = {
  id: string;
  intakeSubmissionId: string;
  organizationId: string;
  officeId: string;
  createdByUserId: string;
  proposedAssetClass?: AssetClass;
  proposedPropertyObject?: Record<string, unknown>;
  proposedComponents?: Array<Record<string, unknown>>;
  proposedAttributes?: Array<Record<string, unknown>>;
  proposedEconomics?: Array<Record<string, unknown>>;
  confidence: "high" | "medium" | "low";
  fieldConfidence?: Record<string, "high" | "medium" | "low">;
  missingFields?: string[];
  conflicts?: string[];
  clarificationQuestions?: string[];
  verificationSummary?: {
    checked: boolean;
    status: "not_checked" | "partially_verified" | "verified" | "conflict_found" | "unsupported";
    notes?: string[];
  };
  status: "draft" | "needs_clarification" | "approved" | "rejected" | "superseded";
  createdAt: string;
  updatedAt: string;
};
```

AI intake rules:

- AI must not set ownership fields.
- AI must not publish objects.
- AI must not overwrite primary object data without human confirmation.
- Backend must validate AI draft data before writing canonical records.
- Open-source verification must store source, URL when available, check date, result, and confidence.
- Conflicting open-source data must force human review before confirmation.
- Open-source verification is not a legal conclusion.
- All extraction, clarification, approval, rejection, and property creation events must be auditable.

Object edit rule:

```text
Only ownerOfficeId users or platform admins can edit primary object data.
```

## 11. Legal Documents

Legal documents are a separate layer from public property descriptions.

They may belong to:

- organization;
- office;
- property object;
- client intent / lead;
- deal room;
- transaction workflow.

Examples:

- ownership certificate;
- cadastral extract;
- title document;
- lease agreement;
- sale-purchase agreement;
- power of attorney;
- corporate documents;
- passport/ID documents;
- tax documents;
- encumbrance certificate;
- technical passport;
- floor plan;
- permits;
- due diligence report;
- valuation report;
- NDA;
- broker agreement;
- commission agreement.

```ts
type LegalDocument = {
  id: string;
  organizationId: string;
  officeId?: string;
  propertyObjectId?: string;
  clientIntentId?: string;
  dealRoomId?: string;
  uploadedByUserId?: string;
  scope: "organization" | "office" | "property_object" | "client_intent" | "deal_room" | "transaction" | "other";
  kind:
    | "ownership_certificate"
    | "cadastral_extract"
    | "title_document"
    | "lease_agreement"
    | "sale_purchase_agreement"
    | "power_of_attorney"
    | "corporate_document"
    | "passport_or_id"
    | "tax_document"
    | "encumbrance_certificate"
    | "technical_passport"
    | "floor_plan"
    | "permit"
    | "due_diligence_report"
    | "valuation_report"
    | "nda"
    | "broker_agreement"
    | "commission_agreement"
    | "other";
  title: string;
  storagePath: string;
  confidentiality: "public" | "office_private" | "organization_private" | "deal_participants" | "platform_private";
  reviewStatus: "not_reviewed" | "pending_review" | "needs_clarification" | "verified" | "rejected" | "expired";
  issuingAuthority?: string;
  documentNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
};
```

Rules:

- legal documents are private by default;
- access depends on scope, confidentiality, organization/office membership, and deal-room participation;
- platform emergency/moderation access must be audited;
- verification status is not a legal opinion by itself;
- document expiry must be queryable;
- deal-room documents must be visible only to approved participants unless explicitly shared.

## 12. ClientIntent

Represents a client request or lead.

```ts
type ClientIntent = {
  id: string;
  sourceOrganizationId: string;
  sourceOfficeId: string;
  sourceWebsiteId?: string;
  marketId?: string;
  preferredLanguage: LanguageCode;
  preferredCurrency: CurrencyCode;

  clientName?: string;
  clientContact?: string;
  requirementText: string;

  status: "new" | "qualified" | "in_deal_room" | "closed" | "archived";
  createdAt: string;
  updatedAt: string;
};
```

Lead ownership rule:

```text
The source office owns the lead relationship.
```

## 13. CoBrokerRequest

Represents a request from one office to another regarding an object.

```ts
type CoBrokerRequest = {
  id: string;
  propertyObjectId: string;
  fromOrganizationId: string;
  fromOfficeId: string;
  toOrganizationId: string;
  toOfficeId: string;
  clientIntentId?: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired" | "closed";
  message?: string;
  createdAt: string;
  updatedAt: string;
};
```

## 14. InterOfficeDealRoom

Connects a client request, selected objects, and the offices representing each side.

```ts
type InterOfficeDealRoom = {
  id: string;
  clientIntentId: string;
  propertyObjectIds: string[];
  sellerOrganizationId: string;
  sellerOfficeId: string;
  buyerOrganizationId: string;
  buyerOfficeId: string;
  status: "draft" | "sent" | "viewed" | "active" | "closed" | "archived";
  createdAt: string;
  updatedAt: string;
};

type DealRoomEvent = {
  id: string;
  dealRoomId: string;
  eventType:
    | "dealroom_created"
    | "shortlist_updated"
    | "object_viewed"
    | "comment_added"
    | "status_changed"
    | "cobroker_request_sent"
    | "cobroker_request_accepted";
  payload: Record<string, unknown>;
  authorUid?: string;
  authorOfficeId?: string;
  createdAt: string;
};
```

## 15. Monetization Placeholders

```ts
type SubscriptionPlan = {
  id: string;
  name: string;
  monthlyPrice?: MoneyValue;
  annualPrice?: MoneyValue;
  objectLimit?: number;
  agentLimit?: number;
  websiteLimit?: number;
  analyticsAccess: "none" | "basic" | "advanced";
  supportLevel: "standard" | "priority";
  active: boolean;
};

type OfficeSubscription = {
  id: string;
  organizationId: string;
  officeId: string;
  planId: string;
  status: "trial" | "active" | "past_due" | "suspended" | "cancelled";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
};
```

## 16. Market Analytics Placeholders

```ts
type MarketIndicator = {
  id: string;
  marketId: string;
  metric: string;
  segment?: string;
  value: number;
  unit: string;
  currency?: CurrencyCode;
  period: string;
  source: string;
  confidence: "high" | "medium" | "low" | "unsupported";
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

type MarketInsight = {
  id: string;
  marketId: string;
  title: LocalizedText;
  body: LocalizedText;
  sources: string[];
  confidence: "high" | "medium" | "low" | "unsupported";
  published: boolean;
  createdAt: string;
  updatedAt: string;
};
```

## 17. Audit Log

```ts
type AuditLogEntry = {
  id: string;
  actorUid?: string;
  actorOrganizationId?: string;
  actorOfficeId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
};
```

## 18. Relational Tables

Recommended PostgreSQL tables:

```text
offices
organizations
markets
app_users
organization_memberships
office_memberships
site_configs
site_object_visibility_overrides
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

## 19. Documentation Rule

Any significant schema change must update:

- `docs/02-DATA-MODEL.md`
- `docs/03-API-CONTRACTS.md` if API shape changes
- `docs/CURRENT_STATE.md`

For high-impact changes, add an ADR before implementation.
