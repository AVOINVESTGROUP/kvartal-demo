# AGENTS.md — KVARTAL Development Agents & Protocol

## Project Overview

**Project:** KVARTAL Real Estate Brokerage Platform  
**Scope:** Commercial real estate brokerage + investment property matching for Moscow/Russia and Dubai/UAE markets  
**Target User:** High-net-worth individuals, corporate real estate managers, institutional investors seeking properties, off-plan investments, and deal partnership opportunities

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
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── ROADMAP.md
│   ├── AGENT_PROTOCOL.md
│   ├── TECH_STACK.md
│   ├── DATA_MODEL.md
│   ├── ACCEPTANCE_CRITERIA.md
│   ├── RESOURCE_INVENTORY.md
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
- **First Rollout:** Failed (repo not yet a Next.js app — will fix in Stage 1/2)
- **Status:** Ready for setup after Next.js scaffold
- **Current Action:** Do not touch Firebase now. No deploy. No rollout changes.

## Next Step

After Stage 0 approval:

1. Review all documentation and agent rules
2. Confirm design token mapping
3. Plan Stage 1: Next.js monorepo scaffold
4. Create Stage 1 plan for approval
5. Execute Stage 1: pnpm workspace + turbo + root config

---

**Stage 0 Status:** Documentation and agent setup in progress  
**Execution Mode:** Plan-first, approval required before Stage 1
