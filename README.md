# README.md — KVARTAL Real Estate Brokerage Platform

## Overview

**KVARTAL** is a modern real estate brokerage platform for commercial properties and investment opportunities in Moscow/Russia and Dubai/UAE markets.

### Central Product Model

**Client Intent → Deal Room → Telegram Mini App → Broker / Partner Pipeline**

Prospects submit property requirements → system matches properties and creates personal Deal Rooms → real-time updates via Telegram Mini App → broker handoff and partnership pipeline.

## Markets

1. **Moscow / Russia**
   - Commercial real estate (особняки, нежилые здания, офисные объекты)
   - Special assets in ЦАО (Central Administrative Okrug)
   - Office and retail spaces
   - Negotiated sales and long-term leases

2. **Dubai / UAE**
   - Investment properties (off-plan and ready)
   - Partnership opportunities
   - High-net-worth investor networks
   - International property portfolios

## Key Features (Roadmap)

- **Deal Room:** Personalized workspace for each client intent with matched properties
- **AI Intake:** Vertex AI classifies client requirements and generates broker summaries
- **Telegram Mini App:** Push notifications and quick deal updates in Telegram
- **SSOT Data Model:** Property objects, intents, and deals live in project backend
- **Broker Pipeline:** Hand-off to agent network, CRM tracking, commission workflows
- **Analytics:** GA4 + BigQuery for market insights and deal tracking

## Technology Stack

- **Frontend:** Next.js 14+ with React + TypeScript, Tailwind CSS
- **Backend:** Cloud Run (Node.js/TypeScript), Firebase Functions as alternative
- **Database:** Firestore or Cloud SQL (decision in Stage 3)
- **Storage:** Cloud Storage for media and documents
- **Auth:** Firebase Auth + App Check
- **AI:** Vertex AI + Gemini API
- **Hosting:** Firebase App Hosting (production), Cloud Run (API)
- **Analytics:** GA4, BigQuery, Looker Studio
- **Secrets:** Google Secret Manager
- **Observability:** Cloud Logging, Cloud Monitoring

**Related repository:** `https://github.com/AVOINVESTGROUP/kvartal-demo`

**Developer setup:** `docs/10-DEVELOPER-SETUP.md`

**Design Reference:** `index.html` (approved, never modified)

## Development Rules

1. **Plan First:** Every task requires an approved plan before execution
2. **No Secrets in Code:** All secrets go to Secret Manager
3. **Update CURRENT_STATE:** After every execution step
4. **No Deploy Without Approval:** All cloud changes require explicit sign-off
5. **Preserve Design:** Original `index.html` is never modified
6. **Google-First:** Firebase and Google Cloud services are primary
7. **Next.js Only:** No Angular, no other frameworks for frontend

## Project Structure

```
C:\Dev\Kvartal\
├── docs/                    # Documentation
├── .agents/                 # Agent rules and skills
├── .vscode/                 # VS Code configuration
├── index.html              # Approved design reference
├── AGENTS.md               # Agent definitions
└── README.md               # This file
```

## Stages

1. **Stage 0:** Documentation + agent setup ✅ (current)
2. **Stage 1:** Next.js monorepo scaffold
3. **Stage 2:** Migrate design to Next.js Web MVP
4. **Stage 3:** SSOT data model definition
5. **Stage 4:** Deal Room + TMA MVP
6. **Stage 5:** AI intake integration
7. **Stage 6:** Firebase/App Hosting deployment
8. **Stage 7:** Analytics and reporting

## Firebase Project

- **Project ID:** kvartal-dev
- **Project Number:** 544286782827
- **App Hosting:** kvartal-web-dev
- **Region:** europe-west4
- **Status:** Ready for setup after Next.js scaffold is complete

## Next Step

Review `AGENTS.md` and documentation in `docs/` folder. After approval, Stage 1 planning will begin.

---

**Last Updated:** Stage 0 setup  
**Status:** Planning phase
