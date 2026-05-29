# AGENTS.md — KVARTAL Development Agents & Protocol

## Project Overview

**Project:** Fixer.guru / KVARTAL Real Estate Partner Platform  
**Source of Truth:** `docs/00-MASTER-ARCHITECTURE.md`  
**Scope:** Fixer.guru-owned partner-network real estate platform with branded partner sites, shared public inventory, organization admin, co-broker deal flow, AI-assisted intake, legal documents, and monetizable data access.  
**Target Users:** Fixer.guru platform owner/team, partner organizations such as KVARTAL Moscow and Apart4u.co Tbilisi, organization employees, brokers, property owners, buyers, tenants, and investors.

## Central Product Model

**Client Intent → Deal Room → Telegram Mini App → Broker / Partner Pipeline**

1. **Client Intent:** Prospect submits property requirements, investment goals, risk profile
2. **Deal Room:** Personalized workspace showing matched property objects, negotiation status, documentation, AI insights
3. **Telegram Mini App:** Push notifications, quick property updates, deal milestones in Telegram
4. **Broker Pipeline:** Lead hand-off to broker + partner network, CRM tracking, commission workflows

## Technology Stack (Approved)

- **Frontend:** Next.js + React + TypeScript (Server Components first, Client Components for interactive UI)
- **Backend:** Cloud Run (Node.js/TypeScript), Firebase Functions as alternative
- **Database:** Firestore or Cloud SQL (decision in Stage 3)
- **Storage:** Cloud Storage (media, PDF, documents)
- **Auth:** Firebase Auth + App Check
- **AI/ML:** Vertex AI + Gemini API (intake classification, deal summaries)
- **Analytics:** GA4 + GTM + BigQuery + Looker Studio
- **Secrets:** Google Secret Manager
- **Observability:** Cloud Logging + Cloud Monitoring
- **Hosting:** Firebase App Hosting (primary production), Cloud Run (secondary for API)

**Angular is forbidden.** Only Next.js for frontend.  
**Vercel is not primary production hosting.** Firebase App Hosting is primary.

## Design Reference

- **Approved Design:** `C:\Dev\Kvartal\index.html` (preserved, never modified)
- **Design Copy:** `docs/design/approved-index.html` (for reference)
- **Design System:** `docs/design/DESIGN_SYSTEM.md` (exact color tokens and design values)
- **Tailwind Mapping:** `docs/design/TAILWIND_MAPPING.md` (conversion to Tailwind CSS)

## Key Principles

Все действия агента регулируются набором правил в `.agents/rules/`. Ниже приведены краткие ссылки на ключевые принципы:

1. **SSOT (Single Source of Truth):** См. правило `01-kvartal-ssot-principle.md`.
2. **Request-First:** См. правило `02-two-market-architecture.md`.
3. **Two Markets:** См. правило `02-two-market-architecture.md`.
4. **Deal Room Lifecycle:** См. правило `03-deal-room-state-machine.md`.
5. **AI Guardrails:** См. правило `04-compliance-guardrails.md`.
6. **Execution Protocol:** См. правило `05-step-by-step-execution.md` (Plan-Approval-Execution).
7. **Security & Secrets:** См. правило `06-security-and-secrets.md`.
8. **Approved Design Preservation:** См. правило `10-approved-design-preservation.md`.

## Execution Rules

### Safe Mode (Default)

Работа строго по протоколу `05-step-by-step-execution.md`.

### Reporting After Execution

Отчеты формируются согласно шаблону в `08-reporting-template.md`.

### Staged Execution

- **Stage 0:** Documentation, agent rules, design reference (current)
- **Stage 1:** Next.js monorepo scaffold
- **Stage 2:** Migrate approved design to Next.js Web MVP
- **Stage 3:** SSOT data model definition
- **Stage 4:** Deal Room + TMA MVP
- **Stage 5:** AI intake integration
- **Stage 6:** Firebase/App Hosting deployment
- **Stage 7:** Analytics and reporting

## Project Structure

```
C:\Dev\Kvartal\
├── index.html                    # Approved design (NEVER modify)
├── AGENTS.md                     # This file
├── README.md                     # Project overview
├── docs/                         # Documentation
│   ├── 00-MASTER-ARCHITECTURE.md # Current source of truth
│   ├── 02-DATA-MODEL.md
│   ├── 03-API-CONTRACTS.md
│   ├── 05-DEAL-ROOM-SPEC.md
│   ├── 06-AI-SYSTEM.md
│   ├── 13-ROLE-SCHEMA-DRAFT.md
│   ├── 14-AI-PROPERTY-INTAKE.md
│   ├── 15-GOOGLE-DATA-GOVERNANCE.md
│   ├── 16-PARTNER-NETWORK-PLATFORM.md
│   ├── 17-PARTNER-NETWORK-IMPLEMENTATION-PLAN.md
│   ├── 18-GOOGLE-ACCOUNT-AUTH.md
│   ├── CURRENT_STATE.md
│   ├── FIREBASE_APP_HOSTING_TROUBLESHOOTING.md
│   ├── archived/superseded/      # Historical docs, not current SSOT
│   └── design/
│       ├── APPROVED_DESIGN.md
│       ├── approved-index.html   # Copy of index.html (reference only)
│       ├── DESIGN_SYSTEM.md
│       └── TAILWIND_MAPPING.md
├── .agents/                      # Agent instructions
│   ├── rules/                    # Shared rules for all agents
│   │   ├── 00-core-rules.md
│   │   ├── 01-google-stack.md
│   │   ├── 02-security.md
│   │   ├── 03-product-context.md
│   │   ├── 04-reporting.md
│   │   ├── 05-code-style.md
│   │   └── 06-approved-design.md
│   └── skills/                   # Specialized agent skills
│       ├── planning.skill.md
│       ├── implementation.skill.md
│       ├── review.skill.md
│       ├── gcp.skill.md
│       ├── frontend-next.skill.md
│       ├── backend.skill.md
│       ├── ai.skill.md
│       └── design-migration.skill.md
└── .vscode/                      # VS Code workspace config
    ├── settings.json
    └── extensions.json
```

## Firebase Project Status

- **Project Name:** KVARTAL Dev
- **Project ID:** kvartal-dev
- **Project Number:** 544286782827
- **App Hosting Backend:** kvartal-web-dev
- **Region:** europe-west4
- **Status:** Active development project with App Hosting, Cloud Run, Cloud SQL, Firebase Auth, and Secret Manager resources.
- **Current State:** See `docs/CURRENT_STATE.md`.

## Next Step

Use `docs/00-MASTER-ARCHITECTURE.md` and `docs/CURRENT_STATE.md` before planning or implementing new work.

---

**Status:** Active implementation.  
**Execution Mode:** Follow the current user request and project guardrails.
