# Fixer.guru Partner Network Platform

**Date:** 2026-05-28  
**Status:** Product architecture draft for approval  
**Supersedes wording:** "multi-office platform" where it implies equal offices rather than partner organizations.

## 1. Core Idea

Fixer.guru is the platform owner and operator.

The product is not just a set of websites. It is a controlled real estate data and deal network:

```text
Fixer.guru Platform
-> one governed property and deal database
-> partner real estate organizations
-> branded partner websites
-> shared public inventory
-> controlled access to private data
-> co-broker deal flow
-> monetization of access, leads, cooperation, and platform services
```

Partner websites are made for real real estate organizations, current and future:

```text
KVARTAL Moscow
Apart4u.co Tbilisi
Future Yerevan partner
Future Dubai partner
Future partner organizations
```

Each partner organization can have its own brand, website design, domain, employees, clients, offices, objects, leads, and deal pipeline. The shared value is that all partner sites can display eligible objects from the common platform inventory, while data access remains controlled by Fixer.guru policy and by the information rights holder.

## 2. Correct Business Roles

### Fixer.guru

Fixer.guru is not just another broker organization in the network.

Fixer.guru is:

- platform owner;
- infrastructure owner/operator;
- database access controller;
- monetization controller;
- partner onboarding controller;
- audit and governance controller;
- global product administrator.

Fixer.guru may operate through a platform organization record in the database for permissions and billing, but product language must treat it as the platform operator.

### Partner Organization

A partner organization is a real estate company using the Fixer.guru platform.

Examples:

```text
KVARTAL Moscow
Apart4u.co Tbilisi
Yerevan Partner
Dubai Partner
```

Each partner organization:

- has its own admin workspace;
- has its own branded public site;
- enters and manages its own data;
- owns the information it contributes;
- receives leads from its own site;
- can represent buyer-side or seller-side clients;
- can access shared inventory only according to platform rules, publication rules, subscriptions, and explicit grants.

### Office / Branch

An office is not the main platform tenant. It is a local operating unit inside a partner organization.

Example:

```text
Partner Organization: Apart4u.co
  Office: Tbilisi Office

Partner Organization: KVARTAL Moscow
  Office: Moscow Office
```

Use office for city/branch operations, not for naming the main apps.

## 3. Product Surfaces

### Platform Owner Console

Owned by Fixer.guru.

Purpose:

- onboard partner organizations;
- configure partner sites/domains;
- configure access plans and monetization;
- manage shared inventory rules;
- manage platform policies;
- view audit logs;
- resolve partner disputes;
- manage subscriptions and feature flags;
- inspect platform-wide analytics.

Proposed app name:

```text
apps/platform-admin
```

### Partner Organization Console

Used by partner organizations.

Purpose:

- manage organization profile;
- manage offices/branches;
- manage employees and brokers;
- create and edit own objects;
- upload legal documents;
- control object publication;
- receive own-site leads;
- request access/co-broker cooperation on other partners' objects;
- manage deal rooms and commission agreements.

Proposed app name:

```text
apps/partner-admin
```

This is one multi-tenant app, not a hand-built separate codebase for every partner. Tenant is resolved by authenticated membership and optionally by admin domain.

Examples:

```text
admin.apart4u.co        -> partner-admin tenant Apart4u.co
admin.kvartal-pro.ru    -> partner-admin tenant KVARTAL Moscow
console.fixer.guru/...  -> partner-admin tenant selected by membership
```

### Partner Public Site

Each partner has its own public site and design.

Purpose:

- present the partner's brand;
- show partner profile and local expertise;
- display eligible shared inventory;
- receive client requests;
- attribute leads to the source partner organization;
- start buyer-side/seller-side cooperation flow.

Proposed app name:

```text
apps/partner-site
```

This is a multi-tenant site engine with tenant-specific themes and domains.

Examples:

```text
apart4u.co      -> Apart4u.co Tbilisi design and site context
kvartal-pro.ru  -> KVARTAL Moscow design and site context
future.am       -> Yerevan partner design and site context
future.ae       -> Dubai partner design and site context
```

The existing `C:\Dev\Apart4U\apart.html` is an input design source for the Apart4u.co partner-site theme, not for platform admin.

## 4. Shared Inventory on Partner Sites

Each partner site can show:

- the partner's own published objects;
- other partners' published/shared objects;
- selected platform-approved inventory;
- future investment projects when access/publishing rules allow it.

Example:

```text
Client visits apart4u.co.
Client sees a Moscow object owned by KVARTAL Moscow.
Client submits request on apart4u.co.
Lead belongs to Apart4u.co as buyer-side organization.
Object remains owned by KVARTAL Moscow as seller-side organization.
System creates co-broker request or deal room.
Apart4u.co represents buyer.
KVARTAL Moscow represents seller.
Commission is split by agreement.
Fixer.guru may receive platform fee, subscription fee, lead fee, transaction fee, or data access fee.
```

## 5. Data Rights

Core rule:

```text
The organization that contributes information remains the information rights holder for that information.
```

This does not mean the partner owns the platform. It means the partner controls its contributed private information according to platform policy.

Fixer.guru controls:

- platform rules;
- access plans;
- infrastructure;
- audit;
- monetization;
- publishing network rules;
- partner onboarding/suspension;
- global moderation.

Information rights holder controls:

- its own object details;
- private owner/seller-side information;
- legal documents it uploaded;
- private notes;
- publication decision for its own objects within platform policy;
- approval for cooperation where required.

## 6. Public vs Private Data

Public showcase data is explicitly published inventory data.

Required condition:

```text
visibility = public
publicationStatus = published
```

Public showcase must not expose by default:

- legal documents;
- lead PII;
- buyer contacts;
- owner private contacts;
- seller private terms;
- internal economics;
- confidential commission terms;
- AI verification conflicts;
- private address details when hidden;
- draft or archived objects.

## 7. Deal Roles

The platform must separate object ownership from client ownership.

```text
Seller-side organization:
  represents owner/seller/landlord/originator
  usually object owner organization

Buyer-side organization:
  represents buyer/tenant/investor
  usually lead source organization

Platform operator:
  Fixer.guru
  controls rules, access, monetization, audit
```

Example:

```text
Object: Moscow commercial property
Object owner organization: KVARTAL Moscow
Seller-side organization: KVARTAL Moscow

Lead source site: apart4u.co
Lead owner organization: Apart4u.co
Buyer-side organization: Apart4u.co

Deal room:
  seller-side = KVARTAL Moscow
  buyer-side = Apart4u.co
  commission split = agreement-specific
```

## 8. Recommended App Names

Target names:

```text
apps/web
apps/platform-admin
apps/partner-admin
apps/partner-site
apps/platform-api
apps/partner-api
apps/public-api
```

Meaning:

- `web`: Fixer.guru/KVARTAL main public platform site if needed.
- `platform-admin`: Fixer.guru owner console.
- `partner-admin`: multi-tenant console for partner organizations.
- `partner-site`: multi-tenant branded public websites for partner organizations.
- `platform-api`: platform owner backend.
- `partner-api`: authenticated partner operations backend.
- `public-api`: safe public inventory and lead intake backend for partner sites.

Avoid using `office-admin` and `office-api` as product names because offices are branches inside partner organizations, not the main business tenant.

## 9. Initial Partner Seeds

The data model should seed and support:

```text
Platform Operator:
  Fixer.guru

Partner Organization:
  KVARTAL Moscow
  office: Moscow Office
  market: Moscow / Russia
  role in examples: seller-side for Moscow inventory

Partner Organization:
  Apart4u.co
  office: Tbilisi Office
  market: Tbilisi / Georgia
  public site: apart4u.co
  design source: C:\Dev\Apart4U\apart.html
  role in examples: buyer-side for leads from Tbilisi site, plus own inventory later

Partner Organization:
  Future Yerevan Partner
  office: Yerevan Office
  market: Yerevan / Armenia

Partner Organization:
  Future Dubai Partner
  office: Dubai Office
  market: Dubai / UAE
```

## 10. Monetization Model

Fixer.guru monetizes platform access and network participation.

Possible monetization layers:

- partner setup/onboarding fee;
- partner site setup fee;
- monthly partner subscription;
- paid access to shared inventory;
- premium visibility/publication packages;
- lead routing fee;
- co-broker transaction fee;
- platform fee from successful deals;
- analytics access tiers;
- document/AI processing usage fees;
- white-label domain/site fee.

The data model must not assume unlimited free access.

## 11. Required Data Concepts

Current schema already has many base entities. The product language should evolve toward:

```text
PlatformOperator
PartnerOrganization
PartnerOffice
PartnerSite
PartnerSiteTheme
PartnerDomain
PartnerSubscription
DataAccessPlan
SharedInventoryGrant
ObjectPublishingRule
LeadSourceSite
BuyerSideOrganization
SellerSideOrganization
CoBrokerRequest
DealRoom
CommissionAgreement
CommissionSplit
PlatformFee
BillingEvent
AuditLog
```

Implementation may map these to existing tables initially, but docs, API contracts, and UI names should use the business terms clearly.

## 12. Non-Negotiable Rules

- Fixer.guru is platform owner/operator.
- Partner organizations are tenants/clients/partners, not equal owners of the platform.
- A partner site can display other partners' eligible objects.
- A lead belongs to the site/partner where the client submitted it.
- An object remains controlled by its information rights holder.
- Buyer-side and seller-side organizations must be tracked separately.
- Private data is not shared just because an object appears on a public partner site.
- Commission sharing must be explicit and agreement-based.
- Platform monetization must be part of the architecture from the beginning.
