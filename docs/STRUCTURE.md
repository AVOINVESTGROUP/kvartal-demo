# KVARTAL PROJECT STRUCTURE & DOCUMENTATION ARCHITECTURE

## 📁 Required Directory Structure

```
C:\Dev\Kvartal\
├── .agents/
│   ├── rules/
│   │   ├── 00-claude-core-mandate.md
│   │   ├── 01-kvartal-ssot-principle.md
│   │   ├── 02-two-market-architecture.md
│   │   ├── 03-deal-room-state-machine.md
│   │   ├── 04-compliance-guardrails.md
│   │   └── 05-step-by-step-execution.md
│   └── skills/
│       ├── kvartal-architecture-design.skill.md
│       ├── kvartal-deal-room-implementation.skill.md
│       ├── kvartal-ai-integration.skill.md
│       ├── kvartal-partner-layer.skill.md
│       ├── kvartal-data-modeling.skill.md
│       └── kvartal-compliance-review.skill.md
│
├── docs/
│   ├── 00-KVARTAL-OVERVIEW.md (executive summary)
│   ├── 01-ARCHITECTURE.md (technical design)
│   ├── 02-DATA-MODEL.md (entities, schemas, migrations)
│   ├── 03-API-CONTRACTS.md (OpenAPI specs)
│   ├── 04-MVP-SCOPE.md (phases 1-3 detail)
│   ├── 05-DEAL-ROOM-SPEC.md (state machine, events, UI)
│   ├── 06-AI-SYSTEM.md (confidence model, guardrails, training)
│   ├── 07-PARTNER-LAYER.md (Dubai handoff, SLA, verification)
│   ├── 08-COMPLIANCE-PLAN.md (RU/UAE/DLD requirements)
│   ├── 09-DEPLOYMENT.md (CI/CD, environments, monitoring)
│   └── 10-CURRENT-STATE.md (live status, decisions, blockers)
│
├── CLAUDE_COPILOT_OPERATING_SYSTEM.md (this file, personalized AI system)
├── KVARTAL_IMPLEMENTATION_ROADMAP.md (detailed phase breakdown)
├── KVARTAL_BASE_DOCUMENT_v1.md (reference from vault)
├── AGENTS.md (agent definitions)
├── README.md (project overview)
└── CURRENT_STATE.md (phase tracking)
```

---

## 📋 Documentation Files to Create (Next Steps)

### Priority 1: Architecture Foundation (THIS SESSION)
These files establish the technical blueprint before ANY coding:

```
docs/00-KVARTAL-OVERVIEW.md
├─ Executive summary (1 page)
├─ Two markets defined
├─ Request-first model explained
├─ Deal room mechanics
└─ MVP scope

docs/01-ARCHITECTURE.md
├─ System diagram (frontend, backend, 3rd parties)
├─ Monorepo structure (Next.js + TMA)
├─ Data flow (web → CRM, web → Telegram, partner → KVARTAL)
├─ Integration points (CRM webhook, Telegram bot, DLD)
└─ Technology stack decisions

docs/02-DATA-MODEL.md
├─ Core entities (ClientIntent, PropertyObject, Listing, DealRoom, ...)
├─ Relationships (1:N, M:N, no circular deps)
├─ Firestore vs PostgreSQL decision
├─ Migrations strategy
├─ Role-based access control (who sees what)
└─ Indexes for performance

docs/03-API-CONTRACTS.md
├─ RESTful endpoint definitions (OpenAPI 3.0)
├─ Authentication/Authorization
├─ Request/response schemas (Zod)
├─ Error codes and fallback behaviors
├─ Rate limiting and pagination
└─ Webhooks (CRM inbound, partner updates, TMA callbacks)

docs/04-MVP-SCOPE.md
├─ Phase 1: Web MVP (must-have features from §19.1 of base doc)
├─ Phase 2: SSOT + Admin (database layer)
├─ Phase 3: Deal Room + TMA (core product)
├─ Phase 4: AI MVP (qualification + fallback)
├─ Phase 5: Dubai partner layer
└─ Excluded from MVP (§19.2)

docs/05-DEAL-ROOM-SPEC.md
├─ State machine (5 states + transitions)
├─ Events (dealroom_created, object_viewed, comment_added, ...)
├─ Functions (secret link, PDF, tracking, CTA)
├─ UI mockups (web view + TMA view)
├─ Database schema (deal_rooms, dealroom_events, dealroom_objects)
└─ WebSocket integration for real-time updates

docs/06-AI-SYSTEM.md
├─ Confidence model (high, medium, low, unsupported, sensitive)
├─ Guardrails (what AI can/cannot say)
├─ Fallback UX (AI refusal → CTA → CRM creation)
├─ Modules for MVP (intent extraction, broker summary)
├─ Modules post-MVP (fit score, investment snapshot)
├─ Integration with backend (request format, response format)
└─ Evals and quality metrics

docs/07-PARTNER-LAYER.md
├─ Partner verification (DLD ORN/BRN checks)
├─ Handoff lifecycle (assigned → accepted → contacted → ...)
├─ SLA rules (response times, escalations)
├─ Partner dashboard (basic for MVP, full post-MVP)
├─ Data scoping (what partner sees, audit logs)
└─ Monetization model decision

docs/08-COMPLIANCE-PLAN.md
├─ Blockers before launch (RU PII, UAE ad permit, consent)
├─ RU: 152-ФЗ compliance (data residency, GDPR-like rules)
├─ UAE: Personal Data Protection Law (cross-border transfer)
├─ Dubai: DLD rules (advertising permit, cold calling restrictions)
├─ Consent gates (separate intents for marketing, partner transfer)
├─ Audit logs and data export capabilities
└─ Partner data access boundaries

docs/09-DEPLOYMENT.md
├─ Environments (local, staging, production)
├─ CI/CD pipeline (Git → tests → deploy)
├─ Secrets management (environment variables, Secret Manager)
├─ Monitoring and logging (error tracking, metrics, alerts)
├─ Database backup strategy
└─ Rollback procedures

docs/10-CURRENT-STATE.md (LIVE DOCUMENT)
├─ Current phase
├─ Completed decisions (ADRs)
├─ In-progress work
├─ Known blockers
├─ Next phase prerequisites
└─ Team capacity and timeline
```

---

## 🎯 Document Creation Sequence

### Session 1 (Today): Architecture Blueprint
1. Create `docs/00-KVARTAL-OVERVIEW.md` — executive summary + core concepts
2. Create `docs/01-ARCHITECTURE.md` — system design, integration points
3. Create `docs/02-DATA-MODEL.md` — entities, relationships, access control
4. Create `docs/03-API-CONTRACTS.md` — endpoint definitions

### Session 2: Feature Specifications
5. Create `docs/04-MVP-SCOPE.md` — phase breakdown
6. Create `docs/05-DEAL-ROOM-SPEC.md` — state machine, events, UI
7. Create `docs/06-AI-SYSTEM.md` — confidence model, guardrails, training

### Session 3: Non-Functional & Compliance
8. Create `docs/07-PARTNER-LAYER.md` — partner handoff, verification, SLA
9. Create `docs/08-COMPLIANCE-PLAN.md` — RU/UAE/DLD requirements
10. Create `docs/09-DEPLOYMENT.md` — CI/CD, monitoring, backups

### Session 4+: Implementation Playbooks
11. Create `docs/11-PHASE-1-PLAYBOOK.md` — step-by-step for web MVP
12. Create `docs/12-PHASE-2-PLAYBOOK.md` — step-by-step for SSOT + admin
13. Create `docs/13-PHASE-3-PLAYBOOK.md` — step-by-step for deal room + TMA

---

## 📚 Skills Files (AI Agent Knowledge)

Created in `.agents/skills/`:

1. **kvartal-architecture-design.skill.md** — Multi-market design, SSOT principle, compliance
2. **kvartal-deal-room-implementation.skill.md** — State machine, events, WebSocket
3. **kvartal-ai-integration.skill.md** — Confidence model, guardrails, fallback UX
4. **kvartal-partner-layer.skill.md** — Verification, SLA, handoff lifecycle
5. **kvartal-data-modeling.skill.md** — Schema design, migrations, performance
6. **kvartal-compliance-review.skill.md** — RU/UAE/DLD checks, consent gates, audit

---

## 🛑 Hard Rules (Rules Files in `.agents/rules/`)

1. **00-claude-core-mandate.md** — What I must do (architecture, strategy, audits)
2. **01-kvartal-ssot-principle.md** — Objects in backend, CRM for leads only
3. **02-two-market-architecture.md** — Moscow ≠ Dubai, never one-size-fits-all
4. **03-deal-room-state-machine.md** — Every state transition must be explicit
5. **04-compliance-guardrails.md** — AI cannot promise guarantees, only options
6. **05-step-by-step-execution.md** — Plan → approve → execute → validate

---

## ✅ Next Actions

**Today (This Session):**
- [x] Read KVARTAL_Base_Document_v1.md completely
- [x] Understand operating system (hard rules, 7 user flows, state machines)
- [x] Create CLAUDE_COPILOT_OPERATING_SYSTEM.md (this role definition)
- [ ] **CREATE docs/00-KVARTAL-OVERVIEW.md** — START HERE

**After Overview Approval:**
- [ ] CREATE docs/01-ARCHITECTURE.md
- [ ] CREATE docs/02-DATA-MODEL.md
- [ ] CREATE docs/03-API-CONTRACTS.md

**Then:**
- [ ] User reviews architecture documents
- [ ] Blockers and decisions get recorded
- [ ] Phase 1 (Web MVP) planning begins

---

## 🤖 AI Agent Activation

**For Claude (me):**
- Primary: Architecture design, ADRs, risk audits, compliance review
- When: User asks "design X," "what about Y," "is this pattern OK?"

**For Gemini/other agents:**
- Focus: Documentation, code generation, testing, routine implementation
- When: User says "execute" or specific implementation tasks

**For all agents:**
- Always reference KVARTAL_Base_Document_v1.md (source of truth)
- Always preserve SSOT principle (backend owns objects)
- Always include compliance review before feature sign-off
- Always update CURRENT_STATE.md after decisions

---

**Status:** 🟢 READY FOR PHASE 1 ARCHITECTURE DESIGN  
**Next File:** docs/00-KVARTAL-OVERVIEW.md (executive summary)
