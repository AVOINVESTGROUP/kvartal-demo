# KVARTAL Multi-Office Platform Architecture

**Date:** 2026-05-28  
**Status:** Draft for approval  
**Purpose:** Full human-readable project architecture for the expanded KVARTAL platform model.  
**Audience:** project owner, developers, product team, implementation agents, future platform operators.

## 1. Human Introduction

KVARTAL is no longer just a single real estate website for one brokerage company.

The project should become a scalable real estate brokerage platform where multiple independent local firms operate under one shared technology layer. Each firm can have its own website, brand, city focus, language, currency preferences, agents, clients, and local business process. At the same time, all firms contribute to and use one shared property database.

The first planned offices are:

- Moscow
- Tbilisi
- Yerevan

The long-term model must support more cities, countries, languages, currencies, agencies, and investment markets.

The core business idea is simple:

```text
Different local firms have their own websites and clients.
All firms contribute to one shared property database.
The firm that entered the object remains the information rights holder.
Other firms can bring buyers or tenants and represent their side in the deal.
The platform owner manages the system, access, monetization, and future expansion.
```

Example:

```text
Moscow firm enters a Moscow property on behalf of the owner.
The Moscow firm represents the owner's side.

A buyer in Tbilisi sees or requests this object through the Tbilisi website.
The Tbilisi firm represents the buyer's side.

The system creates an inter-office deal room:
Moscow office = seller/owner representative.
Tbilisi office = buyer representative.

The property data remains owned and controlled by the Moscow office.
The lead and buyer relationship remain controlled by the Tbilisi office.
```

This creates a network effect: every new office increases the value of the shared database, while every office keeps control over the information and clients it contributes.

## 2. Product Definition

KVARTAL should be designed as a multi-tenant real estate brokerage SaaS platform with:

- separate local websites for connected firms;
- one shared property storefront;
- one shared SSOT database;
- strict ownership rules for property data;
- inter-office representation logic;
- multilingual content;
- multicurrency pricing;
- developer-owned platform administration;
- office-owned operational administration;
- future public analytics for investment market dynamics;
- future monetization for connected firms.

The platform should support both public marketing websites and private operational workspaces.

## 3. Central Product Model

The previous model:

```text
Client Intent -> Deal Room -> Telegram Mini App -> Broker / Partner Pipeline
```

The expanded model:

```text
Platform Admin
-> Connected Offices
-> Local Websites
-> Shared Property SSOT
-> Client Intent
-> Inter-Office Deal Room
-> Seller-Side Office + Buyer-Side Office
-> Analytics + Monetization
```

In practical terms:

```text
Office contributes object
-> object enters shared database
-> local websites display eligible objects
-> client submits request through local office site
-> system identifies object owner office and lead source office
-> inter-office deal room is created
-> each office represents its own side
```

## 4. Platform Ownership Model

The platform itself belongs to the developer/operator.

The developer/operator controls:

- system administration;
- connected firms;
- subscription and monetization rules;
- technical access;
- platform-wide settings;
- feature flags;
- domains;
- languages;
- currencies;
- analytics publishing;
- moderation policies;
- global compliance rules.

Connected offices do not own the platform. They receive access to operate inside the platform according to their subscription, permissions, and data rights.

## 5. Two Administrative Layers

The platform must have two separate administration zones.

### 5.1 Platform Admin

Platform Admin belongs to the platform owner/developer.

It is used to manage the whole system, not day-to-day brokerage work for one office.

Platform Admin responsibilities:

- create and manage offices;
- activate or suspend offices;
- configure office websites;
- configure domains and subdomains;
- configure available languages;
- configure available currencies;
- manage subscription plans;
- manage billing state;
- set usage limits;
- manage feature flags;
- assign platform-level roles;
- review platform-wide object quality;
- moderate public analytics;
- manage dictionaries and reference data;
- manage market definitions;
- manage system compliance settings;
- inspect audit logs;
- resolve inter-office disputes.

Platform Admin routes may later live under:

```text
/platform
/platform/offices
/platform/subscriptions
/platform/domains
/platform/markets
/platform/analytics
/platform/audit
```

### 5.2 Office Admin

Office Admin belongs to each connected firm.

It is used by the local firm to manage its own operational work.

Office Admin responsibilities:

- manage office profile;
- manage office agents;
- add property objects;
- edit property objects owned by the office;
- publish/archive objects owned by the office;
- upload photos and documents for owned objects;
- receive leads from the office website;
- send requests to other offices;
- manage deals where the office participates;
- represent owners/sellers for owned objects;
- represent buyers/tenants for local leads;
- track commission and co-broker status.

Office Admin routes may later live under:

```text
/admin
/admin/objects
/admin/leads
/admin/deals
/admin/agents
/admin/settings
```

Important: an office must not be able to edit another office's primary object data.

## 6. Local Websites and Shared Storefront

Each office should be able to have its own public website.

Examples:

```text
moscow.example.com
tbilisi.example.com
yerevan.example.com
```

Or independent domains:

```text
kvartal-moscow.ru
kvartal-tbilisi.ge
kvartal-yerevan.am
```

Each local website may have:

- its own brand presentation;
- local contact information;
- local office team;
- local primary language;
- local default currency;
- local market pages;
- local SEO metadata;
- local lead forms;
- local analytics views;
- the shared object storefront filtered or prioritized by market.

The storefront is shared at the data level, but localized at the presentation level.

Example:

```text
The same Moscow object may appear:
- on the Moscow office site in Russian and RUB;
- on the Tbilisi office site in Georgian/Russian/English and USD/GEL;
- on the Yerevan office site in Armenian/Russian/English and USD/AMD.
```

The system must preserve attribution:

```text
Object rights holder: Moscow Office
Buyer request source: Tbilisi Office
```

## 7. Data Ownership Principle

The core rule:

```text
The office that enters the property object remains the information rights holder.
```

This means:

- the contributor office owns and controls the primary property record;
- other offices can view published objects;
- other offices can request cooperation on published objects;
- other offices cannot change title, description, photos, price, address, owner-side terms, or legal fields;
- platform admin can moderate or intervene according to platform policy;
- all changes must be logged.

Property data ownership is separate from client ownership.

Example:

```text
Moscow Office owns Object A.
Tbilisi Office owns Lead B.
Deal Room C connects Object A and Lead B.
Moscow Office represents owner/seller.
Tbilisi Office represents buyer.
```

## 8. Representation Model

The platform must support different representation sides.

Common sides:

- owner/seller representative;
- buyer representative;
- landlord representative;
- tenant representative;
- investment originator;
- partner introducer;
- platform operator.

For a simple MVP:

```text
Seller-side office = object owner office.
Buyer-side office = lead source office.
```

In future, this may expand into:

- multiple buyer-side agents;
- external partners;
- referral-only participants;
- commission split rules;
- exclusivity periods;
- confidential/off-market access.

## 9. Multilingual Architecture

The platform must be multilingual from the data model onward.

Initial practical languages:

- `ru` Russian
- `en` English

Future languages:

- `ka` Georgian
- `hy` Armenian
- `ar` Arabic

Content should not be hardcoded only in one language.

Translatable fields:

- property title;
- property description;
- address display;
- district display;
- tags;
- SEO title;
- SEO description;
- market insight title;
- market insight body;
- office public profile;
- website navigation labels;
- forms and UI strings.

Recommended content model:

```ts
type LocalizedText = {
  ru?: string;
  en?: string;
  ka?: string;
  hy?: string;
  ar?: string;
};
```

Example:

```ts
type PropertyObject = {
  title: LocalizedText;
  description: LocalizedText;
  addressDisplay: LocalizedText;
};
```

For MVP, Russian can be required and other languages optional.

## 10. Multicurrency Architecture

The platform must support multicurrency pricing.

Initial currencies:

- `RUB`
- `USD`
- `EUR`
- `GEL`
- `AMD`
- `AED`

Price should not be stored as a plain display string only.

Recommended model:

```ts
type MoneyValue = {
  amount: number;
  currency: "RUB" | "USD" | "EUR" | "GEL" | "AMD" | "AED";
};

type Price = {
  mode: "on_request" | "fixed" | "range";
  primary?: MoneyValue;
  min?: MoneyValue;
  max?: MoneyValue;
  displayOverride?: LocalizedText;
};
```

Currency conversion should be stored as snapshots when needed:

```ts
type CurrencyRateSnapshot = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  source: string;
  capturedAt: string;
};
```

Important:

- original entered currency must be preserved;
- converted values are display helpers, not the legal price;
- rate source and timestamp must be tracked;
- public pages must clearly distinguish original price from converted estimate.

## 11. Future Public Analytics: Investment Market Dynamics

The platform should later include a public analytics block.

Working name:

```text
Investment Market Dynamics
```

This block should not be mixed directly into property objects.

It should be a separate data layer that can power public pages, reports, investor dashboards, and SEO content.

Analytics may include:

- price per square meter dynamics;
- rental rate dynamics;
- market yield ranges;
- demand by property type;
- liquidity indicators;
- vacancy rates;
- currency impact;
- comparison between Moscow, Tbilisi, Yerevan, Dubai, and future markets;
- investment attractiveness index;
- public commentary with source attribution.

Recommended entities:

```ts
type MarketIndicator = {
  id: string;
  marketId: string;
  metric: string;
  segment?: string;
  value: number;
  unit: string;
  currency?: string;
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

Compliance rule:

```text
Analytics can describe market dynamics and ranges.
Analytics must not promise guaranteed investment returns.
```

## 12. Core Entities

### 12.1 PlatformTenant / Office

Represents a connected firm or office.

```ts
type Office = {
  id: string;
  slug: string;
  legalName: string;
  displayName: LocalizedText;
  city: string;
  country: string;
  defaultMarketId: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  defaultCurrency: string;
  supportedCurrencies: string[];
  status: "draft" | "active" | "suspended" | "archived";
  subscriptionPlanId?: string;
  websiteConfigId?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 12.2 Market

Represents a geographic and business market.

```ts
type Market = {
  id: string;
  slug: string;
  city: string;
  country: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
  supportedLanguages: string[];
  assetClasses: string[];
  complianceRegion: "RU" | "GE" | "AM" | "UAE" | "OTHER";
  active: boolean;
};
```

### 12.3 PropertyObject

Represents a real property object in the shared SSOT.

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

  assetClass: string;
  areaSqm?: number;
  landAreaSqm?: number;
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

### 12.4 ClientIntent / Lead

Represents a client's request.

```ts
type ClientIntent = {
  id: string;
  sourceOfficeId: string;
  sourceWebsiteId?: string;
  marketId?: string;
  preferredLanguage: string;
  preferredCurrency: string;
  clientName?: string;
  clientContact?: string;
  requirementText: string;
  status: "new" | "qualified" | "in_deal_room" | "closed" | "archived";
  createdAt: string;
  updatedAt: string;
};
```

### 12.5 InterOfficeDealRoom

Connects a lead, an object, and the offices representing each side.

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
```

### 12.6 CoBrokerRequest

Represents a request from one office to another regarding a property.

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

### 12.7 SubscriptionPlan

Defines future monetization.

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
```

### 12.8 OfficeSubscription

Represents an office's active platform subscription.

```ts
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

## 13. Roles and Permissions

Initial roles:

- `platform_owner`
- `platform_admin`
- `office_owner`
- `office_admin`
- `broker`
- `analyst`
- `viewer`

Permission principles:

```text
Platform Owner/Admin:
Can manage the whole platform.

Office Owner/Admin:
Can manage own office, own users, own objects, own leads, own deals.

Broker:
Can work with assigned objects, leads, and deal rooms inside office permissions.

Analyst:
Can manage market indicators and insights if granted.

Viewer:
Read-only scoped access.
```

Permission matrix:

| Action | Platform Admin | Owner Office | Other Office |
|---|---:|---:|---:|
| Create office | Yes | No | No |
| Suspend office | Yes | No | No |
| Create own object | Yes | Yes | Yes |
| Edit own object | Yes | Yes | No |
| Edit another office object | Yes, with audit | No | No |
| View public object | Yes | Yes | Yes |
| Request co-broker deal | Yes | Yes | Yes |
| See another office private leads | Yes, with policy | No | No |
| Configure subscription | Yes | No | No |
| Publish analytics | Yes | Optional | Optional |

## 14. Data Access Rules

Objects:

- public users can read only public/published objects;
- network offices can read objects visible to the office network;
- only owner office can edit primary object data;
- platform admin can intervene with audit log;
- archived objects are hidden from public storefronts.

Leads:

- lead belongs to source office;
- seller-side office can see only deal-relevant lead details after approved cooperation flow;
- platform admin can access lead records according to platform policy and compliance requirements.

Deal Rooms:

- seller-side office and buyer-side office can access the shared deal room;
- unrelated offices cannot access the deal room;
- all status changes are logged.

Analytics:

- published insights are public;
- draft insights are visible only to authorized platform/admin/analyst roles.

## 15. Firestore Collection Draft

Recommended MVP collections:

```text
offices
markets
users
officeUsers
propertyObjects
clientIntents
coBrokerRequests
dealRooms
dealRoomEvents
siteConfigs
domainConfigs
subscriptionPlans
officeSubscriptions
currencyRateSnapshots
marketIndicators
marketInsights
auditLogs
```

This can start in Firestore for speed, Firebase Auth integration, and App Hosting compatibility.

If the platform later needs heavy reporting, relational joins, billing analytics, or complex market analytics, selected data can be mirrored into BigQuery or moved into Cloud SQL/PostgreSQL for analytical workloads.

## 16. Website Configuration

Each office website should be driven by configuration.

```ts
type SiteConfig = {
  id: string;
  officeId: string;
  domain?: string;
  subdomain?: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  defaultCurrency: string;
  supportedCurrencies: string[];
  primaryMarketIds: string[];
  brandName: LocalizedText;
  contactEmail?: string;
  contactPhone?: string;
  themePreset?: string;
  analyticsEnabled: boolean;
  active: boolean;
};
```

This allows:

- one codebase;
- multiple websites;
- different domains;
- different languages;
- different default currencies;
- different office branding.

## 17. Key User Flows

### 17.1 Office Adds Object

```text
Office admin logs in
-> creates property object
-> selects market
-> enters multilingual content
-> enters original price and currency
-> uploads photos
-> saves as draft
-> publishes to office network or public storefront
```

Result:

```text
ownerOfficeId = current office
informationOwnerOfficeId = current office
```

### 17.2 Buyer Requests Object From Another City

```text
Buyer opens Tbilisi website
-> sees Moscow property
-> submits request
-> lead belongs to Tbilisi office
-> system detects Moscow office as property owner office
-> creates co-broker request or deal room
```

Result:

```text
buyerOfficeId = Tbilisi
sellerOfficeId = Moscow
```

### 17.3 Inter-Office Deal Room

```text
Buyer-side office sends request
-> seller-side office accepts
-> deal room becomes active
-> object, lead, comments, documents, and status are tracked
-> commission rules can be attached later
```

### 17.4 Platform Connects New Office

```text
Platform admin creates office
-> assigns subscription
-> configures domain/site
-> invites office owner
-> office owner invites agents
-> office starts adding objects and receiving leads
```

### 17.5 Analytics Publication

```text
Analyst or platform admin enters market indicator
-> adds source and confidence
-> creates localized insight
-> platform admin approves publication
-> public analytics block displays insight
```

## 18. Monetization Direction

The platform should be prepared for monetization, even if billing is not implemented in the first technical stage.

Possible monetization models:

- monthly office subscription;
- per-agent pricing;
- object publication limits;
- premium visibility;
- analytics access tiers;
- lead routing fees;
- co-broker transaction fees;
- white-label website fee;
- setup/onboarding fee.

Do not hardcode free unlimited access into the architecture.

Every office should have:

- subscription state;
- feature flags;
- usage limits;
- billing profile placeholder;
- activation/suspension state.

## 19. Compliance and Trust

The platform will operate across multiple countries and must treat trust, data rights, and compliance as first-class concerns.

Important principles:

- no secret tokens in repository;
- no uncontrolled CRM as SSOT;
- every object has a data rights owner;
- every critical change has audit log;
- every lead has a source office;
- investment claims require source and confidence;
- no guaranteed return promises;
- private owner/client data must not be exposed publicly;
- each market may require its own compliance fields.

## 20. Technology Direction

Approved stack remains:

- Next.js + React + TypeScript;
- Firebase App Hosting;
- Firebase Auth;
- Firestore for MVP SSOT;
- Cloud Storage for media;
- Google Cloud / Cloud Run for later API services;
- Vertex AI / Gemini for later AI workflows;
- BigQuery for later analytics aggregation.

The architecture should avoid Angular and avoid Vercel as primary production hosting.

## 21. Revised Stage 3

Previous Stage 3:

```text
SSOT + Admin MVP for one company.
```

New Stage 3:

```text
Multi-Office SSOT Foundation + Platform/Office Admin Separation.
```

Stage 3 should include:

- update architecture documentation;
- define `Office`, `Market`, `PropertyObject`, `ClientIntent`, `DealRoom` basics;
- implement Firebase Auth foundation;
- create Platform Admin shell;
- create Office Admin shell;
- support at least three seed offices: Moscow, Tbilisi, Yerevan;
- add object ownership fields;
- replace hardcoded public object data with SSOT-ready data layer;
- prepare localization structure;
- prepare multicurrency price structure;
- prepare seed data script;
- avoid full monetization implementation, but include subscription placeholders;
- avoid full analytics implementation, but include data model placeholders.

Stage 3 should not yet include:

- real payment processing;
- full public analytics dashboard;
- full Telegram Mini App;
- AI qualification;
- CRM integrations;
- production deployment without explicit approval.

## 22. Implementation Priorities

Recommended order:

1. Documentation alignment.
2. Data model types.
3. Firebase configuration.
4. Seed offices and markets.
5. Public object data abstraction.
6. Office Admin MVP.
7. Platform Admin MVP shell.
8. Security rules draft.
9. Local verification.
10. Deployment planning only after approval.

## 23. Open Decisions

Decisions needed before full implementation:

1. Final names of the first three offices.
2. Whether each office has a separate domain now or only future support.
3. Initial languages for MVP: Russian only, or Russian + English.
4. Initial currencies for MVP: RUB + USD, or also GEL/AMD.
5. Whether public users can see all shared objects immediately or only curated published objects.
6. Whether other offices can send co-broker requests automatically or require owner-office approval.
7. Whether Platform Admin should be built in Stage 3 as a real UI or only as a protected shell.
8. Whether monetization is subscription-first, lead-fee-first, or only prepared as placeholders.

## 24. Non-Negotiable Rules

- Root `index.html` remains untouched.
- Shared object database is the SSOT.
- CRM cannot become object SSOT.
- The object contributor remains information rights holder.
- Leads belong to the source office.
- Deal rooms connect sides without transferring data ownership.
- Platform Admin and Office Admin must be separate concepts.
- Multilingual and multicurrency structures must be prepared before scale.
- Analytics must have sources, dates, and confidence levels.
- No guaranteed investment return claims.

## 25. One-Sentence Project Summary

KVARTAL is a developer-owned multi-office real estate brokerage platform where local firms operate their own sites, contribute to a shared rights-aware property database, represent their own clients in inter-office deals, and eventually monetize access, analytics, and network participation across multiple cities, languages, and currencies.
