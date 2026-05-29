# KVARTAL Architecture Overview

**Version:** 0.1  
**Last Updated:** 2026-05-20  
**Status:** 🟡 In Design (Architecture review phase)  
**Audience:** Technical team, architects, product stakeholders  

---

## Executive Summary

KVARTAL is a **request-first, deal room-centric real estate platform** serving two distinct markets (Moscow commercial + Dubai investment) with a unified backend architecture. The platform converts client tasks into curated property shortlists via AI qualification, then delivers them through web and Telegram Mini App (TMA) interfaces.

**Core Thesis:** Small, curated, expert-driven > large, algorithmic, self-service

### Key Differentiators

| Aspect | KVARTAL | Traditional Catalogs |
|--------|---------|----------------------|
| **Entry Point** | Client task (need) | Property browse (supply) |
| **Qualification** | AI + broker filter | User self-qualify |
| **Delivery** | Curated deal room | Search results list |
| **Engagement** | Broker-led, personal | Self-service, digital |
| **Fallback** | Broker CTA + context | Dead end (no matches) |
| **Data Model** | SSOT в бэкенде (см. `rule 01`) | CRM as SSOT (WRONG) |

---

## Core Product Flows

### Flow 1: Instant Moscow Task (Web MVP)
```
User submits task on /moscow/new-task
↓
"I need office space 500m², budget 2–3M RUB, near Mayak"
↓
AI qualification (Gemini): parse intent, check confidence
↓
Backend query: objects matching { square: 500, budget_range, location_proximity }
↓
Broker review: shortlist 2–3 best matches (expert curation)
↓
Create deal room (state: draft)
↓
Send to user (state: sent)
↓
User views (state: viewed) + interactions (state: active)
↓
Broker schedules viewing → offline event → CRM update
```

**Duration:** 15 min (task to shortlist)  
**Success:** User views 3+ objects, books viewing

### Flow 2: Complex Dubai Investment (Partner-Led)
```
User task: "500K AED investment, 6%+ yield, near Marina"
↓
AI qualification: mark as "medium confidence" (investment claims complex)
↓
Query backend: objects matching params (developer sourced)
↓
Partner handoff: assign to Dubai partner with SLA
↓
Partner verifies yields, collects DLD docs, contacts user
↓
Create deal room with investment snapshots + DLD verification
↓
User views in TMA → interacts with broker/partner
↓
Viewing scheduled → CRM deal created
```

**Duration:** 2–5 days (task to first viewing)  
**Success:** User views property, attends consultation

### Flow 3: Multi-Property Comparison (Web)
```
User visits /compare
↓
"Show me top 3 Moscow office + top 3 Dubai investment"
↓
AI-driven shortlist: confidence model (high/medium/low)
↓
Create side-by-side deal room (market-aware layout)
↓
User explores via charts (price/yield/location)
↓
Choose favorite → convert to dedicated deal room
↓
Broker outreach via CRM
```

**Duration:** 5 min (explore)  
**Success:** User requests more info on 1+ properties

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERFACES                            │
│  ┌──────────────────┐         ┌──────────────────────────┐     │
│  │   Web Frontend   │         │  Telegram Mini App (TMA) │     │
│  │  (Next.js)       │         │   (Embedded, deep links) │     │
│  │  - /moscow/      │◄────────┤   - Deal room views      │     │
│  │  - /dubai/       │         │   - Notifications        │     │
│  │  - /compare/     │         │   - Quick actions        │     │
│  │  - /admin/       │         │   - Contact broker       │     │
│  └─────────┬────────┘         └─────────────┬────────────┘     │
│            │                                 │                  │
└────────────┼─────────────────────────────────┼──────────────────┘
             │                                 │
             └─────────────────┬───────────────┘
                               │
        ┌──────────────────────▼─────────────────────────┐
        │      KVARTAL BACKEND (Cloud Run / Node.js)     │
        │  ┌─────────────────────────────────────────┐   │
        │  │  REST API (v1, versioned)               │   │
        │  │  - /api/v1/objects (SSOT)               │   │
        │  │  - /api/v1/deal-rooms (state machine)   │   │
        │  │  - /api/v1/deal-rooms/{id}/events       │   │
        │  │  - /api/v1/ai/qualify (async)           │   │
        │  │  - /api/v1/auth (Firebase)              │   │
        │  └─────────────────────────────────────────┘   │
        │  ┌─────────────────────────────────────────┐   │
        │  │  WebSocket Layer (TMA real-time)        │   │
        │  │  - subscribe('dealroom:{id}')           │   │
        │  │  - event stream (comment, status)       │   │
        │  └─────────────────────────────────────────┘   │
        │  ┌─────────────────────────────────────────┐   │
        │  │  Core Services                          │   │
        │  │  - Auth (Firebase, OAuth)               │   │
        │  │  - Intent qualification (Gemini)        │   │
        │  │  - Deal room orchestration              │   │
        │  │  - Event sourcing & audit               │   │
        │  └─────────────────────────────────────────┘   │
        └──────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┬──────────────┐
        │                  │                  │              │
    ┌───▼────────┐  ┌─────▼──────┐  ┌──────▼────┐  ┌──────▼──────┐
    │  Database  │  │ Gemini API │  │ CRM API   │  │ Telegram    │
    │  (Postgres │  │ (Intent,   │  │ (Webhook) │  │ Bot API     │
    │  or FS)    │  │  broker    │  │           │  │             │
    │            │  │  summary)  │  │  (one-way)│  │ (TMA links) │
    └────────────┘  └────────────┘  └───────────┘  └─────────────┘
```

### Data Flows (Key Integrations)

#### 1. Web → Backend
```
User submits task (web form)
  ↓
POST /api/v1/ai/qualify
  Request: { task_text, market, budget_range }
  ↓
Backend validates, calls Gemini (if high confidence)
  ↓
Backend queries objects (SQL/Firestore)
  ↓
Response: { shortlist: [{object_id, match_score, reason}], confidence: 'high'|'medium'|'low' }
  ↓
Web creates deal room (state: draft)
  ↓
POST /api/v1/deal-rooms (create)
  Response: { room_id, secret_link, share_token }
```

#### 2. Backend → CRM (Webhook, One-Way)
```
Event: "deal_room_status_changed" (sent → viewed → active)
  ↓
POST https://crm.partner.com/webhook/kvartal
  Body: { dealroom_id, state, objects_count, broker_id, timestamp }
  ↓
CRM creates/updates lead & deal
  ↓
Broker gets notification in CRM
  ↓
NO REVERSE: CRM updates do not sync back to KVARTAL
  (Only API calls to KVARTAL are respected)
```

#### 3. Backend → Telegram Mini App (WebSocket + Push)
```
User opens deal room in TMA
  ↓
TMA connects: WebSocket('wss://api.kvartal.com/ws/dealroom/{room_id}')
  ↓
Subscribe to room updates (events stream)
  ↓
Broker adds comment → event generated
  ↓
WebSocket sends: { event_type: 'comment_added', object_id, text, timestamp }
  ↓
TMA displays comment in real-time
  ↓
If high priority → send push notification
```

#### 4. Partner Handoff Flow (Dubai-Specific)
```
AI detects Dubai investment task (market=dubai, confidence=medium+)
  ↓
POST /api/v1/partner-handoffs (assign to partner)
  Request: { dealroom_id, partner_id, objects: [...], sla_hours: 24 }
  ↓
Partner receives notification (dashboard or email)
  ↓
Partner accepts/rejects within SLA
  ↓
Partner contacts user (via CRM link or direct)
  ↓
Partner provides verification docs (DLD, developer, yield)
  ↓
Update deal room with partner investment snapshot
  ↓
User views deal room (see investment snapshot + DLD docs)
  ↓
Backend tracks handoff state (assigned → accepted → contacted → viewing → offer → closed)
```

---

## Data Model: Core Entities

### 1. PropertyObject (Backend SSOT)
```
Properties in Moscow or Dubai. Single source of truth.
One property → Multiple units (for projects) → Multiple listings (different prices/terms)

Fields:
- id, market, status (active, archived)
- name, type (office, apartment, special_use)
- location (lat, long, neighborhood)
- area_sqm, floor, building_year
- [market_specific fields]
  Moscow: docs_checklist, investment_scenario, transfer_timeline
  Dubai: developer, payment_plan, yield_estimated, dld_verified
- created_by (broker_id or partner_id)
- created_at, updated_at, verified_at
```

### 2. Listing
```
Commercial offer for a property (price, terms, availability)

One PropertyObject → N Listings (e.g., rent 100K RUB/year, sale 3M RUB)

Fields:
- id, property_id, market
- type (sale, rent, investment)
- price, currency
- terms (lease duration, payment schedule)
- availability_date
- status (active, sold, archived)
- created_at, updated_at
```

### 3. ClientIntent
```
User's task/request (captured for each deal room)

Fields:
- id, market, source (web, tma, referral)
- task_text (user's input)
- structured_intent {
    goal: 'invest'|'occupy'|'resell',
    budget_min, budget_max, currency,
    area_min_sqm, area_max_sqm,
    required_features: [],
    timeline: 'urgent'|'next_month'|'flexible'
  }
- ai_qualification {
    confidence: 'high'|'medium'|'low'|'unsupported'|'sensitive',
    reasoning: "...",
    eligible_objects: [object_ids],
    next_step: 'shortlist'|'broker_cta'|'data_missing'
  }
- created_at
```

### 4. DealRoom (State Machine: 5 States)
```
Curated property selection for a client intent

States:
1. draft — broker is building, not yet sent
2. sent — sent to client, waiting for open
3. viewed — client opened link
4. active — client interacting (viewing objects, adding notes, contacting broker)
5. closed — deal won, lost, or archived

Fields:
- id, intent_id
- state (5 states above)
- state_transitions: [{ from, to, reason, timestamp }]
- objects: [{ object_id, added_at, broker_note }]
- participants: [{ user_id, role: 'client'|'broker'|'partner', added_at }]
- secret_link, share_token
- events: [dealroom_events] (immutable log)
- metadata {
    view_count, comment_count, last_active_at,
    pdf_requested: true|false, pdf_sent_at
  }
- created_at, created_by (broker_id)
- updated_at
```

### 5. DealRoomEvent (Immutable, Event-Sourced)
```
Immutable log of all deal room activities (audit trail)

Fields:
- id, dealroom_id
- event_type (object_added, comment_added, status_changed, viewed, pdf_downloaded, etc.)
- actor_id, actor_type (broker, client, system)
- actor_name (display name at time of event)
- metadata { object_id, comment, new_state, ... }
- visibility (all, broker_only, — partner handoff uses broker_only for internal notes)
- created_at (immutable)
- INDEX on (dealroom_id, created_at DESC) for efficient queries
```

### 6. PartnerHandoff (Dubai-Specific)
```
Lead transfer to Dubai partner with SLA tracking

Fields:
- id, dealroom_id
- partner_id, partner_name (audit: name at time of assignment)
- state (assigned, accepted, contacted, consultation, shortlist, viewing, offer, closed)
- state_transitions: [{ from, to, reason, timestamp }]
- sla_accept_by, sla_contact_by, sla_next_milestone_at
- last_update_at
- stale_hours (if no update after N hours, escalate)
- dld_verification_status (required, pending, verified, rejected)
- verification_documents: [{ type, uploaded_at, verified_at }]
- created_at, assigned_by (broker_id)
- updated_at
```

### 7. InvestmentSnapshot
```
Dubai-specific: investment metrics with source attribution

Used in DealRoomObject or PartnerHandoff context

Fields:
- id
- dealroom_object_id (or dealroom_id + object_id)
- yield_pct, yield_confidence (high, medium, low)
- yield_source {
    type: 'developer'|'partner_estimate'|'market_data',
    partner_id, date, disclaimer
  }
- service_charges_aed_annual
- service_charges_source: string
- risks: [{ category, severity, mitigation }]
- rental_estimate_aed_monthly
- rental_estimate_source: string
- payback_years
- verified_at, verified_by
- created_at
```

---

## API Design Principles

### Versioning
- All endpoints prefixed: `/api/v1/`, `/api/v2/`, etc.
- Backward compatibility: v1 endpoints never change (deprecation = new version)
- No breaking changes within major version

### Authentication
- Firebase Auth (web) + custom tokens (TMA via Telegram)
- Token-based with role (broker, client, partner, admin)
- CORS: localhost (dev), *.kvartal.app (prod)

### Response Format
```json
{
  "success": true,
  "data": { /* entity data */ },
  "meta": { "timestamp": "2026-05-20T...", "request_id": "..." },
  "errors": null
}

// Error response:
{
  "success": false,
  "data": null,
  "errors": [
    { "code": "INVALID_MARKET", "message": "Market must be moscow or dubai", "field": "market" }
  ]
}
```

### Pagination
```
GET /api/v1/deal-rooms?limit=10&offset=0

Response:
{
  "data": [...],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 42,
    "has_more": true
  }
}
```

### WebSocket Events (TMA Real-Time)
```
// Subscribe
client.subscribe('dealroom:{room_id}', { token: '...' })

// Events
{
  "type": "comment_added",
  "timestamp": "2026-05-20T14:30:00Z",
  "actor": "Broker John",
  "data": {
    "object_id": "uuid",
    "comment": "Great interest from your side!",
    "visibility": "all"
  }
}

{
  "type": "status_changed",
  "timestamp": "2026-05-20T14:31:00Z",
  "data": {
    "from_state": "sent",
    "to_state": "viewed",
    "reason": "client_opened_link"
  }
}
```

---

## Compliance & Data Governance

### 1. SSOT Boundary
- **Backend owns:** PropertyObject, Unit, Listing, InvestmentSnapshot
- **CRM owns:** Lead, Deal, Task, Communication
- **Never reverse:** No property CRUD via CRM, no lead creation in backend

### 2. Data Residency (Russia)
- Russian PII (user emails, phone if client from Russia) → must stay in RU data center
- Market data (property records, developer info) → can be replicated globally
- **Implementation:** Separate databases for PII vs. market data

### 3. Partner Data Scoping (Dubai)
- Partner sees only: assigned handoffs, object metadata (no pricing details), DLD docs
- Partner cannot see: other leads, broker internal notes, Moscow catalog
- **Implementation:** Role-based access control with field-level encryption

### 4. AI Guardrails
✅ **ALLOWED:**
- "Estimated 4–6% yield based on market data; depends on market cycles"
- "Could work for retail; requires utility upgrade verification"

❌ **PROHIBITED:**
- "Guaranteed 5% return"
- "This is the best investment"
- "Visa guaranteed"

**Implementation:** Response validation + human audit for high-stakes claims

### 5. Consent Gates
- **Marketing consent:** Separate opt-in for broker emails, newsletters
- **Partner transfer consent:** Explicit "I agree to share my info with Dubai partner"
- **Analytics consent:** GTM/GA4 tracking with user acknowledgment

---

## Technology Stack (Decisions Needed)

### Frontend (Decided ✅)
- **Framework:** Next.js 14+ (React, TypeScript)
- **Styling:** Tailwind CSS + exact design tokens from approved index.html
- **Forms:** React Hook Form + Zod validation
- **State Management:** TBD (SWR, React Query, or server state?)
- **TMA Integration:** TMA SDK + WebSocket for real-time

### Backend (Needs Decision)
- **Framework:** Node.js (Express/Fastify) vs Python (FastAPI) vs Go (Gin)?
- **Database:** PostgreSQL vs Firestore?
- **Message Queue:** RabbitMQ / Google Pub/Sub / Redis?
- **AI Service:** Embedded Gemini SDK vs separate service?

### Cloud Infrastructure (Google-First)
- **Compute:** Cloud Run (backend), Firebase App Hosting (frontend)
- **Database:** Cloud SQL (Postgres) or Firestore
- **Storage:** Cloud Storage (PDFs, documents)
- **AI:** Vertex AI / Gemini API
- **Messaging:** Google Pub/Sub
- **Auth:** Firebase Auth + App Check
- **Secrets:** Secret Manager
- **Monitoring:** Cloud Logging, Cloud Monitoring

### External Integrations
- **CRM:** Bitrix24 (webhooks)
- **Telegram:** Bot API, Mini App SDK
- **Maps:** Google Maps API
- **Analytics:** GA4, BigQuery, GTM
- **DLD Verification:** Dubai Land Department API (TBD)

---

## MVP Scope (Phases 1–3)

### Phase 1: Web MVP (6–8 weeks)
- [ ] Homepage (market-aware routing)
- [ ] `/moscow/` page (office properties)
- [ ] `/dubai/` page (investment properties)
- [ ] Object detail cards (market-specific fields)
- [ ] Deal room view (share link, PDF export)
- [ ] Admin panel (basic CRUD)
- [ ] CRM webhook (one-way, basic)

### Phase 2: SSOT + Admin (4–6 weeks)
- [ ] Core data model (PropertyObject, Listing, DealRoom)
- [ ] Admin interface (object management, partner verification)
- [ ] Event sourcing (DealRoomEvent audit trail)
- [ ] Role-based access control

### Phase 3: Deal Room + TMA MVP (6–8 weeks)
- [ ] Deal room state machine (5 states)
- [ ] TMA deep links + real-time updates
- [ ] Broker comment system
- [ ] Partner handoff (basic: assigned, accepted, contacted)
- [ ] CRM integration (full one-way sync)

**Total MVP:** 4–6 months  
**Beyond MVP:** AI qualification (Phase 4), partner portal (Phase 5), analytics (Phase 6)

---

## Known Risks & Blockers

### Blocker 1: Database Decision
- **Impact:** Shapes schema design, migration strategy, costs
- **Timeline:** MUST decide before Phase 2
- **Options:**
  - PostgreSQL (Cloud SQL): familiar, relational, complex queries ✅ 
  - Firestore: serverless, real-time, limited joins ⚠️ 
  - Hybrid: Postgres + Firestore for different entities 🤔 

### Blocker 2: Partner Monetization Model
- **Impact:** Blocks partner portal design (Phase 5)
- **Options:**
  - Revenue share (% of deal value)
  - Pay-per-lead (flat fee per handoff)
  - Subscription (partner pays monthly)

### Blocker 3: DLD Verification Integration
- **Impact:** Dubai launch depends on verified property data
- **Timeline:** Research + API integration (2–3 weeks)
- **Action:** Contact Dubai Land Department for API access

### Risk 1: AI Investment Claim Liability
- **Mitigation:** Strict guardrails, human audit, legal review before launch
- **Timeline:** Legal review in Phase 4

### Risk 2: CRM Webhook Failures
- **Mitigation:** Retry logic, dead-letter queue, manual reconciliation dashboard
- **Timeline:** Phase 2–3

---

## Success Criteria for Architecture

✅ Stakeholders approve SSOT boundary (backend OWNS objects)  
✅ Tech stack decisions documented (database, backend language, AI service)  
✅ API contracts reviewed and versioned  
✅ State machines defined for all entities (DealRoom, Partner Handoff)  
✅ Compliance blockers identified and mitigation plans drafted  
✅ Two markets can be implemented independently with shared core  
✅ Partner data scoping documented (who sees what)  
✅ CRM webhook architecture is one-way (KVARTAL → CRM, never reverse)  
✅ No circular dependencies in data model  

---

## Next Steps

1. **Database Decision** (user input)
   - PostgreSQL or Firestore?
   - Timeline: 1 week

2. **Backend Language Decision** (user input)
   - Node.js, Python, or Go?
   - Timeline: 1 week

3. **API Contract Review** (docs/03-API-CONTRACTS.md)
   - Endpoint definitions (OpenAPI 3.0)
   - Error handling, pagination, versioning
   - Timeline: 2 weeks

4. **Data Model Refinement** (docs/02-DATA-MODEL.md)
   - Field-level specifications, indexes, migrations
   - Timeline: 2 weeks

5. **Partner Layer Design** (docs/07-PARTNER-LAYER.md)
   - Dubai handoff SLA, verification, access scoping
   - Timeline: 2 weeks

6. **Compliance Review** (docs/08-COMPLIANCE-PLAN.md)
   - RU/UAE/DLD requirements, consent gates, audit
   - Timeline: 3 weeks

---

**Architecture Status:** 🟡 **In Design**  
**Next Gate:** User approval on database + backend language  
**Responsible:** Claude (Copilot) + User decisions
