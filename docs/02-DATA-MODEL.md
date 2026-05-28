# DATA MODEL

**Status:** active draft  
**Last updated:** 2026-05-28  
**Related:** `docs/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md`, `docs/11-STAGE-3-SSOT-ADMIN-PLAN.md`

## 1. Purpose

This document defines the core data model for KVARTAL as a developer-owned multi-office real estate platform.

The model must support:

- multiple connected offices;
- separate local websites;
- one shared property SSOT;
- object information ownership;
- office-owned leads;
- inter-office deal rooms;
- multilingual content;
- multicurrency prices;
- future subscriptions and monetization;
- future public market analytics.

## 2. SSOT Boundary

KVARTAL backend is the source of truth for:

- `Office`
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
- Investment claims require source, date, and confidence.

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

## 5. Office

Represents a connected firm or local office.

```ts
type Office = {
  id: string;
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
  subscriptionPlanId?: string;
  websiteConfigId?: string;
  createdAt: string;
  updatedAt: string;
};
```

Initial offices:

- `moscow`
- `tbilisi`
- `yerevan`

## 6. Market

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

## 7. User and Office Membership

Firebase Auth owns authentication identity. Firestore owns platform role and office membership.

```ts
type PlatformRole =
  | "platform_owner"
  | "platform_admin"
  | "office_owner"
  | "office_admin"
  | "broker"
  | "analyst"
  | "viewer";

type AppUser = {
  uid: string;
  email: string;
  displayName?: string;
  platformRoles: PlatformRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type OfficeUser = {
  id: string;
  officeId: string;
  uid: string;
  roles: PlatformRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
```

## 8. SiteConfig

Represents a local office website configuration.

```ts
type SiteConfig = {
  id: string;
  officeId: string;
  domain?: string;
  subdomain?: string;
  defaultLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  primaryMarketIds: string[];
  brandName: LocalizedText;
  contactEmail?: string;
  contactPhone?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
```

## 9. PropertyObject

Represents a real property object in the shared database.

```ts
type PropertyObject = {
  id: string;
  ownerOfficeId: string;
  createdByUserId: string;
  marketId: string;

  status: "draft" | "published" | "archived";
  visibility: "private" | "office_network" | "public";

  title: LocalizedText;
  description?: LocalizedText;
  addressDisplay: LocalizedText;
  addressPrivate?: string;

  assetClass:
    | "land"
    | "warehouse"
    | "hotel"
    | "office"
    | "retail"
    | "mixed"
    | "investment"
    | "other";

  areaSqm?: number;
  landAreaSqm?: number;
  cadastralNumber?: string;
  price: Price;

  tags: LocalizedText[];
  imageUrls: string[];
  documentRefs?: string[];

  representation: {
    side: "owner" | "seller" | "landlord" | "originator";
    exclusivity?: "exclusive" | "non_exclusive" | "unknown";
  };

  rights: {
    informationOwnerOfficeId: string;
    canBeShownByOtherOffices: boolean;
    requiresOwnerOfficeApprovalForLead: boolean;
  };

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};
```

Object edit rule:

```text
Only ownerOfficeId users or platform admins can edit primary object data.
```

## 10. ClientIntent

Represents a client request or lead.

```ts
type ClientIntent = {
  id: string;
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

## 11. CoBrokerRequest

Represents a request from one office to another regarding an object.

```ts
type CoBrokerRequest = {
  id: string;
  propertyObjectId: string;
  fromOfficeId: string;
  toOfficeId: string;
  clientIntentId?: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired" | "closed";
  message?: string;
  createdAt: string;
  updatedAt: string;
};
```

## 12. InterOfficeDealRoom

Connects a client request, selected objects, and the offices representing each side.

```ts
type InterOfficeDealRoom = {
  id: string;
  clientIntentId: string;
  propertyObjectIds: string[];
  sellerOfficeId: string;
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

## 13. Monetization Placeholders

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
  officeId: string;
  planId: string;
  status: "trial" | "active" | "past_due" | "suspended" | "cancelled";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
};
```

## 14. Market Analytics Placeholders

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

## 15. Audit Log

```ts
type AuditLogEntry = {
  id: string;
  actorUid?: string;
  actorOfficeId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
};
```

## 16. Firestore Collections

Recommended collections:

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

## 17. Documentation Rule

Any significant schema change must update:

- `docs/02-DATA-MODEL.md`
- `docs/03-API-CONTRACTS.md` if API shape changes
- `docs/CURRENT_STATE.md`

For high-impact changes, add an ADR before implementation.
