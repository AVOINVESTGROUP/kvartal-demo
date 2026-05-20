# AVOcopilot: Personalized AI Operating System for KVARTAL

**Author:** Claude 3.5 Sonnet (Based on AVOuniverse Operating System)  
**Last Updated:** 2026-05-20  
**Status:** Active Implementation Framework

---

## 🤖 Core Mandate

Develop **KVARTAL** — a two-market real estate brokerage platform (Moscow + Dubai) with deal room mechanics, AI-driven intent qualification, and Telegram Mini App integration.

**Key Principle:** Not a catalog platform, but a request-first curated brokerage for qualified leads.

---

## 🛑 HARD RULES FOR THIS PROJECT

### 1. Step-by-Step Execution (Non-Negotiable)
```
Plan (with approval) → Prototype/Design → User approval → Implementation → Validation → Next phase
```
- NO code without complete requirements and approval
- NO architecture changes without explicit consent
- Every change must be documented in CURRENT_STATE.md

### 2. Plan-First Discipline
- Every task begins with: **plan** → **present for approval** → **execute only when approved**
- Exception: Tasks explicitly marked "execution mode" in user request

### 3. Factual Rigor
- ZERO hallucinations about KVARTAL scope, features, or technical decisions
- Only use data from:
  - KVARTAL_Base_Document_v1.md (source of truth)
  - User explicit instructions
  - Project documentation in C:\Dev\Kvartal\docs\

### 4. Direct Feedback (No Corporate Softening)
- Architectural audit: speak directly about risks, gaps, anti-patterns
- No sugar-coating; no "could consider"; use clear "MUST," "SHOULD NOT," "CRITICAL BLOCKER"

### 5. Conciseness
- Structured answers: tables, lists, bullets
- NO long prose or unnecessary preambles
- Executive summaries only

### 6. SSOT Data Discipline
- PropertyObject (physical property) lives in KVARTAL backend, NOT CRM
- CRM is for leads, deals, tasks, communication only
- Violating this = architectural failure

---

## 🎯 KVARTAL Core Model (From KVARTAL_Base_Document_v1.md)

### Central Formula
```
User describes task 
  → Gets expert framework from AI
  → Sees relevant objects/scenarios
  → Saves curated selection in Deal Room
  → Broker receives qualified lead with full context
```

### Two Markets
| Market | Primary Persona | MVP Focus |
|--------|-----------------|-----------|
| **Moscow** | Commercial property assistant collecting briefing | Commercial objects, particulars, buildings |
| **Dubai** | Russian-speaking investor seeking returns | Off-plan, ready properties, yield-focused |

### Deal Room Lifecycle
```
draft (AI/broker building)
  → sent (to client)
  → viewed (client opened link)
  → active (interaction happening)
  → closed (won/lost/archived)
```

### 7 Key User Flows (MVP Priority)
1. **Moscow owner** → object evaluation → deal room → pipeline
2. **LPR assistant** → curated selection → secret link → C-level decision
3. **Dubai investor** → AI qualification → investment passport → partner handoff
4. **Partner upload** → CSV/moderation → DLD verification → publication
5. **Return & reactivation** → personalized triggers → TMA notifications
6. **Moscow / Dubai comparison** → budget routing → dual-market scenario
7. **Offline loop** → broker event updates → TMA progress tracking

---

## 📊 Data Model (SSOT Principle)

**Core Entities (Backend = SSOT, CRM = leads only):**

| Entity | Owner | Role |
|--------|-------|------|
| **ClientIntent** | KVARTAL | What user seeks: market, budget, goal, timeline |
| **PropertyObject** | KVARTAL | Physical property: address, coords, area, type |
| **Unit** | KVARTAL | Apartment/office in project (Dubai scale) |
| **Listing** | KVARTAL | Commercial offer: price, currency, deal type |
| **DealRoom** | KVARTAL | Curated selection: state machine, tracking, PDF |
| **PartnerSource** | KVARTAL | Object origin: partner, license, commission model |
| **PartnerHandoff** | KVARTAL | Lead transfer: SLA tracking, state, events |
| **InvestmentSnapshot** | KVARTAL | Dubai card: yield, rent est., risks, source attribution |
| **Lead** | CRM | Operational handoff: only ID, stage, broker |
| **OfflineProgressEvent** | KVARTAL | Call, showing, doc request → deal room event |

**Relationship Principle:**
- One PropertyObject ↔ Many Listings (different prices, currencies, terms)
- One DealRoom ↔ Many Listings (via DealRoomObject join)
- One PartnerHandoff = Child of DealRoom (partner-specific tracking)
- CRM.Lead points to KVARTAL.DealRoom, not vice versa

---

## 🚨 Critical Blockers Before Launch

| Blocker | Solution | KVARTAL Status |
|---------|----------|---|
| PII of Russians stored outside Russia | Russian PII in RU data center, market data in clouds | **TBD** |
| Dubai handoff without consent | Separate consent: "transfer to UAE partner" | **TBD** |
| Unverified Dubai ads | compliance_status: permit/QR/approved | **TBD** |
| AI investment promises | Guardrails: NO guaranteed returns, only ranges | **TBD** |
| CRM as source of truth | Objects in backend, CRM for leads only | **TBD** |

---

## 🛠️ MVP Scope (Phase 1–3)

### INCLUDE
- Request-first homepage (not catalog)
- Market-aware routing
- /compare/ simplified
- Deal room (5 states)
- TMA deep links + notifications
- AI confidence model
- CRM webhook (one-way)
- Event tracking
- SSOT backend + basic admin

### EXCLUDE (Post-MVP)
- Full partner portal (manual moderation first)
- Bidirectional CRM sync
- Personal cabinet outside TMA
- Auto-import Dubai objects
- Multi-language AR
- Vector search (not needed at small scale)

---

## 🎯 AI Guardrails for KVARTAL

### What AI CAN Say
- "Preliminary model: could be suitable for clinic use with checks: electrical, ventilation, permit"
- "Expected yield 4–6% based on market data; not guaranteed, depends on market cycle"
- "Could support visa sponsorship depending on property type and buyer profile; needs specialist review"

### What AI CANNOT Say
- "Yes, suitable for clinic"
- "Guaranteed yield X%"
- "Visa sponsorship guaranteed"
- "This is the best investment"

**Fallback UX:** If AI can't answer → converts to CTA ("Ask broker") with full context passed to CRM.

---

## 📋 Execution Checklist Template

After each phase, report:

```
# Phase X Completion Report

## Summary
[What was delivered]

## Documentation Changed
- file1.md (added X section)
- file2.md (updated Y)

## Architecture Decisions Made
1. [Decision] — rationale
2. [Decision] — rationale

## Blockers Resolved
- Blocker A → Solution B

## Known Issues
- Issue 1 (severity: X, planned fix: Y)

## Next Phase Prerequisites
- [ ] Requirement 1 met
- [ ] Requirement 2 met
- [ ] No blockers remain

## Confirmation
✅ No CRM/SSOT boundary violations
✅ All PII guardrails respected
✅ Compliance checklist updated
```

---

## 🔗 Integration Points

| System | Data | Direction | Frequency |
|--------|------|-----------|-----------|
| **CRM** | Lead ID, status, broker, deal | Webhook from KVARTAL | Real-time |
| **Telegram Bot** | TMA initData, notifications, deep links | Bidirectional | Real-time |
| **Maps API** | Geo-coordinates, area layers | Read-only | Static + user request |
| **S3-compatible Storage** | Documents, PDFs, media | Write (private), read (role-based) | On-demand |
| **DLD Registry** (Dubai) | ORN/BRN verification | Read-only | Manual + batch |
| **AI Service** | Sanitized lead_id, requirements, objects | Read-only | Per request |

---

## 📚 Documentation Layers

1. **KVARTAL_Base_Document_v1.md** — Source of truth (product, flows, data model)
2. **docs/ARCHITECTURE.md** — Technical deep-dives (stacks, deployment, roles)
3. **docs/DATA_MODEL.md** — Schema definitions, relationships, migrations
4. **docs/ACCEPTANCE_CRITERIA.md** — Phase gates, quality metrics
5. **docs/CURRENT_STATE.md** — Live status, decisions, blockers

---

## 👤 Roles & Access Control

| Role | PropertyObject | Listing | DealRoom | Lead | Partner data |
|------|---|---|---|---|---|
| **Visitor** | View public | View | ❌ | ❌ | ❌ |
| **Lead** | View | View | Own rooms | Implicit | ❌ |
| **Moscow Broker** | All | All | Manage | Assign | ❌ |
| **Dubai Partner** | Own objects | Own objects | Assigned rooms | Assigned leads | Own SLA |
| **Compliance** | Audit | Check status | ❌ | Audit | Verify |
| **Admin** | All | All | All | All | All |

---

## 🚀 Next Steps (After Blueprint Approval)

1. **Create technical specifications** for each MVP phase
2. **Finalize architecture decision:** PostgreSQL + Node.js / Python / Go
3. **Establish CI/CD pipeline** before first commit
4. **Plan database migrations** strategy (Firebasestore vs PostgreSQL selection)
5. **Document compliance checklist** for RU/UAE regulations
6. **Prototype deal room state machine** in code (unit tests)

---

**This document is the working contract between user and AI agent.**  
**All deviations from KVARTAL_Base_Document_v1.md require explicit approval.**
