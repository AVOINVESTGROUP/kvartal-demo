# KVARTAL_STAGE_0_ALL_FILES.md

This file contains ALL Stage 0 documentation content. Follow instructions below to extract files to correct locations.

## EXTRACTION INSTRUCTIONS

### Step 1: Create Directories (if not done yet)
```batch
mkdir C:\Dev\Kvartal\docs
mkdir C:\Dev\Kvartal\docs\design
mkdir C:\Dev\Kvartal\.agents
mkdir C:\Dev\Kvartal\.agents\rules
mkdir C:\Dev\Kvartal\.agents\skills
mkdir C:\Dev\Kvartal\.vscode
```

### Step 2: Copy Design Reference
```batch
copy C:\Dev\Kvartal\index.html C:\Dev\Kvartal\docs\design\approved-index.html
```

### Step 3: Extract Each File
Each section below marked with `FILE:` shows the complete content for one file.  
Create the file in the specified location with the exact content provided.

---

---

## FILE: docs/ARCHITECTURE.md

```markdown
# ARCHITECTURE.md — KVARTAL System Architecture

## High-Level Architecture

Client (Web) + Telegram Mini App
    ↓
Firebase App Hosting (Next.js SSR/SSG) [europe-west4]
    ↓
Cloud Run API + Firebase Functions
    ↓
Firestore / Cloud Storage
    ↓
Vertex AI / Gemini (AI Pipeline)
    ↓
GA4 / BigQuery / Looker Studio (Analytics)

## Core Product Flow

**Client Intent → Deal Room → Telegram Mini App → Broker Pipeline**

1. **Client Intent**: Property requirements, investment goals, contact info
2. **Deal Room**: Personalized workspace with matched properties, documents, AI insights
3. **Telegram Mini App**: Push notifications, quick updates, deal milestones
4. **Broker Pipeline**: Lead handoff, CRM tracking, commission workflows

## Two Markets

### Moscow / Russia
- Commercial real estate (офисы, особняки, нежилые)
- Geography: ЦАО (Central Administrative Okrug)
- Brokers: Local licensed agents

### Dubai / UAE
- Investment properties (off-plan, ready)
- Geography: Dubai, Abu Dhabi
- Brokers: International agents, developers

## SSOT Principle

Property objects live in project backend (Firestore/Cloud SQL), NOT in external CRM.
- All property data stored in project database
- CRM receives leads, not source of truth
- Data attribution logged for audit
- External feeds imported and versioned

## Security & Compliance

- Firebase Auth + App Check
- Google Secret Manager for secrets
- Cloud Logging for audit trail
- Data residency: europe-west4
- GDPR/CCPA consent logs
- No PII in public responses

## Technology Layers

- **Frontend**: Next.js 14+ (Server Components first)
- **API**: Cloud Run (Node.js/TypeScript)
- **Database**: Firestore or Cloud SQL (decision in Stage 3)
- **Storage**: Cloud Storage (media, PDFs)
- **Auth**: Firebase Auth
- **AI**: Vertex AI + Gemini
- **Analytics**: GA4 + BigQuery + Looker Studio
- **Secrets**: Google Secret Manager
- **Observability**: Cloud Logging + Cloud Monitoring
```

---

## FILE: docs/CURRENT_STATE.md

```markdown
# CURRENT_STATE.md — Project Status

## Date: 2026-05-20 03:57 UTC+4

## Project Location
C:\Dev\Kvartal

## Current Stage
Stage 0: Documentation, agent rules, design reference setup (IN PROGRESS)

## Approved Design
- Source: C:\Dev\Kvartal\index.html (preserved, never modified)
- Copy: docs/design/approved-index.html
- Status: Design approved, tokens extracted, Tailwind mapping created

## Firebase Project
- Project Name: KVARTAL Dev
- Project ID: kvartal-dev
- Project Number: 544286782827
- App Hosting Backend: kvartal-web-dev
- Region: europe-west4
- First Rollout: FAILED (waiting for Next.js scaffold)
- Action: Do NOT touch Firebase until Stage 2 approval

## Stage 0 Completion
- [x] AGENTS.md
- [x] README.md
- [x] Directory structure
- [ ] All documentation files
- [ ] All agent rules
- [ ] All agent skills
- [ ] VS Code config
- [ ] Design reference copy

## Files NOT Modified
✅ index.html - Preserved exactly

## Commands Run
None (no installs, no deploys, no cloud changes)

## Known Issues
- Firebase rollout waiting for Next.js
- No app code yet
- No database schema yet

## Next Stage
Stage 1: Next.js monorepo scaffold (planning required)

## Next Action
Review all docs, approve Stage 0, request Stage 1 planning
```

---

## FILE: docs/ROADMAP.md

[ROADMAP content - 200+ lines - see KVARTAL_STAGE_0_ROADMAP.md separately]

---

## FILE: docs/TECH_STACK.md

```markdown
# TECH_STACK.md — Technology Stack

## Frontend
- **Framework**: Next.js 14+ with React 18+ and TypeScript
- **Styling**: Tailwind CSS with custom design tokens from approved design
- **Components**: React (Server Components by default, Client Components for interaction)
- **Form Handling**: React Hook Form + Zod validation
- **State Management**: React Context API / TanStack Query (if needed)
- **Routing**: Next.js App Router
- **SEO**: Next.js built-in (SSR/SSG)

## Backend / API
- **Runtime**: Node.js 18+ with TypeScript
- **API Server**: Cloud Run (primary) or Express.js
- **API Style**: REST (primary) or gRPC
- **Database Client**: @firebase/admin, Prisma (if SQL)
- **Validation**: Zod schemas (shared with frontend)
- **Authentication**: Firebase Auth + custom JWT middleware

## Database / Storage
- **Primary Database**: Firestore (decision) or Cloud SQL (decision in Stage 3)
- **Object Storage**: Google Cloud Storage (media, PDFs, documents)
- **Cache**: Redis (optional, post-MVP)
- **Search**: Firestore full-text (basic) or Elasticsearch (advanced)

## External Services
- **Telegram Bot API**: Telegram Mini App integration
- **Telegram Mini App SDK**: @twa-dev/sdk
- **SMS**: Twilio (Russia) or AWS SNS (international)
- **Payment**: Stripe, Yandex.Kassa, Sberbank (by region)

## AI / ML
- **Large Language Model**: Vertex AI Gemini API
- **Use Cases**:
  - Intake classification
  - Deal summaries
  - Broker recommendations
  - Market analysis
- **Vector Search**: Vertex AI Vector Search (optional)

## Google Cloud Services
- **Hosting**: Firebase App Hosting (Next.js) - primary production
- **API Runtime**: Cloud Run (Node.js)
- **Functions**: Firebase Cloud Functions (webhooks, async jobs)
- **Database**: Firestore (or Cloud SQL)
- **Storage**: Cloud Storage
- **Auth**: Firebase Authentication + App Check
- **Secrets**: Google Secret Manager
- **Logging**: Cloud Logging
- **Monitoring**: Cloud Monitoring
- **Build**: Cloud Build (optional, GitHub Actions alternative)
- **Analytics**: BigQuery (GA4 export)

## Development Tools
- **Package Manager**: pnpm (monorepo workspaces)
- **Build Tool**: Turbo (parallel builds)
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions (or Cloud Build)
- **Testing**: Jest, Vitest, Playwright (post-MVP)
- **Linting**: ESLint + Prettier
- **Code Quality**: SonarQube (optional)
- **Secrets Management**: .env.local (dev), Secret Manager (prod)
- **Monitoring**: Sentry (error tracking)

## VS Code Extensions
- Google Cloud Code
- ESLint
- Prettier
- GitLens
- Docker
- YAML
- Markdown All in One
- Tailwind CSS IntelliSense
- REST Client
- PostgreSQL (if using Cloud SQL)

## Design & Branding
- **Design System**: Custom design tokens from approved index.html
- **Colors**:
  - Navy: #071d3a, #0d2e58
  - Red: #c73333, #9f2525
  - Gold: #c9a66b
  - Muted: #697386
  - Background: #f4f6f8, #f7f3ec
- **Typography**: Segoe UI, Arial, sans-serif
- **Spacing**: 8px grid
- **Border Radius**: 18px
- **Container Width**: 1180px

## Compliance & Security
- **Auth**: Firebase Auth (email, phone, OAuth)
- **App Check**: Firebase App Check (API protection)
- **Secrets**: Google Secret Manager
- **Audit Logging**: Cloud Logging
- **Encryption**: TLS in transit, encryption at rest
- **GDPR**: Consent logs, data export, deletion workflows
- **CCPA**: Consent logs, opt-out support

## Deployment Model
- **Frontend**: Firebase App Hosting (auto-deploy from GitHub)
- **Backend API**: Cloud Run (manual or Cloud Build trigger)
- **Functions**: Firebase Cloud Functions (auto-deploy)
- **Infrastructure**: Terraform or gCloud CLI (IaC)
- **Secrets**: Google Secret Manager
- **DNS**: Custom domain registered separately

## Performance Targets
- **Page Load**: <2s (LCP)
- **Time to Interactive**: <3.5s (FID)
- **Cumulative Layout Shift**: <0.1
- **API Response**: <500ms (p95)
- **Database Query**: <100ms (p95)
- **Uptime**: 99.9%

## Post-MVP Considerations
- **WebSocket**: Upgrade to realtime for Deal Room
- **Search**: Elasticsearch for advanced property search
- **Cache**: Redis for session/frequently-accessed data
- **Queue**: Cloud Tasks or Pub/Sub for async jobs
- **Video**: YouTube API for property video integration
- **Maps**: Google Maps API for property location
- **Email**: SendGrid or Cloud Mail API
```

---

## FILE: docs/DATA_MODEL.md

```markdown
# DATA_MODEL.md — KVARTAL Data Model

## Core Entities

### ClientIntent
```
{
  id: string (UUID)
  createdAt: timestamp
  updatedAt: timestamp
  
  // Client Info
  clientName: string
  clientEmail: string
  clientPhone: string
  
  // Requirements
  markets: string[] (e.g., ["Moscow", "Dubai"])
  propertyTypes: string[] (e.g., ["Office", "Retail"])
  minArea: number (m²)
  maxArea: number (m²)
  minPrice: number (USD/RUB)
  maxPrice: number (USD/RUB)
  
  // Goals
  investmentGoal: "Buy" | "Lease" | "Invest" | "Partnership"
  riskProfile: "Conservative" | "Moderate" | "Aggressive"
  timeline: "0-3months" | "3-6months" | "6-12months" | "12+ months"
  
  // Status
  status: "New" | "Pending" | "Active" | "Deal-In-Progress" | "Completed"
  assignedBroker: string (broker ID)
  
  // Consent
  consentGDPR: boolean
  consentAnalytics: boolean
  consentMarketing: boolean
  consentLog: ConsentLog[]
  
  // Notes
  notes: string
  source: "Website" | "Telegram" | "Referral" | "Partnership"
}
```

### PropertyObject
```
{
  id: string (UUID)
  createdAt: timestamp
  updatedAt: timestamp
  
  // Location
  market: "Moscow" | "Dubai"
  address: string
  district: string
  coordinates: { lat: number, lng: number }
  
  // Details
  propertyType: "Office" | "Retail" | "Warehouse" | "Residential" | "Mixed"
  areaTotal: number (m²)
  areaOffice: number (m²)
  areaRetail: number (m²)
  areaWarehouse: number (m²)
  
  // Commercial
  pricePerM2: number (USD/RUB)
  totalPrice: number (USD/RUB)
  currency: "RUB" | "USD" | "AED"
  
  // Amenities
  hasParking: boolean
  hasMeeting: boolean
  hasKitchen: boolean
  hasInternet: boolean
  hasAC: boolean
  
  // Listing
  listingId: string (external)
  dataSourceAttribution: DataSourceAttribution
  
  // Status
  available: boolean
  dealPhase: "Available" | "Negotiating" | "Pending" | "Sold/Leased"
}
```

### DealRoom
```
{
  id: string (UUID)
  createdAt: timestamp
  updatedAt: timestamp
  
  // Parties
  clientIntentId: string
  brokerId: string (primary broker)
  partnerId: string | null (if partnership deal)
  
  // Deal Details
  dealType: "Buy" | "Lease" | "Investment" | "Partnership"
  expectedCloseDate: date
  dealValue: number
  dealCurrency: "RUB" | "USD" | "AED"
  
  // Content
  propertyObjectIds: string[] (properties in deal room)
  documentUrls: string[] (contracts, appraisals, etc.)
  
  // Status
  status: "Initiated" | "Negotiating" | "Pending" | "Completed" | "Cancelled"
  
  // Participants
  participants: DealRoomParticipant[]
  
  // AI Generated
  aiBrokerSummary: string
  aiMatchScore: number (0-100)
}
```

### DealRoomObject
```
{
  id: string
  dealRoomId: string
  propertyObjectId: string
  
  // Deal-specific info
  offerPrice: number
  offerCurrency: string
  negotiationStatus: "Offered" | "Countered" | "Agreed" | "Rejected"
  
  // Ranking
  priority: number (1-10)
  matchScore: number (0-100)
}
```

### DealRoomParticipant
```
{
  id: string
  dealRoomId: string
  userId: string
  userRole: "Client" | "Broker" | "Agent" | "Partner" | "Observer"
  joinedAt: timestamp
  lastActiveAt: timestamp
  
  permissions: {
    canViewDocuments: boolean
    canComment: boolean
    canEditDeal: boolean
    canInviteOthers: boolean
  }
}
```

### Partner
```
{
  id: string
  createdAt: timestamp
  
  // Company Info
  companyName: string
  businessType: "Developer" | "Broker" | "Investor" | "Service"
  
  // Markets
  marketsActive: string[] (["Moscow", "Dubai"])
  
  // Contact
  contactName: string
  contactEmail: string
  contactPhone: string
  
  // API Integration
  apiKey: string (hashed)
  webhookUrl: string
  
  // Status
  active: boolean
}
```

### PartnerHandoff
```
{
  id: string
  createdAt: timestamp
  
  dealRoomId: string
  partnerId: string
  
  handoffDate: timestamp
  handoffNotes: string
  
  externalDealId: string (in partner's system)
  status: "Pending" | "Accepted" | "Rejected" | "Completed"
}
```

### AIInteractionLog
```
{
  id: string
  createdAt: timestamp
  
  // Context
  userId: string
  dealRoomId: string | null
  clientIntentId: string | null
  
  // Interaction
  type: "Intake" | "Summary" | "Recommendation" | "Analysis"
  input: string
  output: string
  model: "gemini-pro"
  tokensUsed: number
  
  // Results
  confidence: number (0-100)
  accuracy: boolean (marked after human review)
}
```

### ConsentLog
```
{
  id: string
  createdAt: timestamp
  
  clientIntentId: string
  consentType: "GDPR" | "CCPA" | "Marketing" | "Analytics"
  action: "Granted" | "Revoked"
  ipAddress: string (hashed)
  userAgent: string
}
```

### DataSourceAttribution
```
{
  source: "API" | "Upload" | "Partner" | "Scrape" | "Manual"
  sourceUrl: string | null
  partnerId: string | null
  importedAt: timestamp
  lastVerified: timestamp
  verificationStatus: "Valid" | "Expired" | "Unverified"
}
```

---

## Relationships

```
ClientIntent 1 ──→ many DealRooms
ClientIntent 1 ──→ many ConsentLogs

PropertyObject ──→ DataSourceAttribution
PropertyObject 1 ──→ many Listings

DealRoom 1 ──→ many DealRoomObjects
DealRoom 1 ──→ many DealRoomParticipants
DealRoom 1 ──→ many DealRoomEvents
DealRoom ──→ AIInteractionLog

Partner 1 ──→ many PartnerHandoffs
```

---

## Firestore Collection Structure

```
/clients/{clientIntentId}
  /deals/{dealRoomId}
  /events/{eventId}
  /documents/{docId}

/properties/{propertyObjectId}
  /listings/{listingId}
  /media/{mediaId}

/brokers/{brokerId}
  /deals/{dealRoomId}

/partners/{partnerId}
  /handoffs/{handoffId}

/logs/
  /interactions/{logId}
  /consents/{logId}
  /analytics/{logId}
```

---

Decision: Firestore vs Cloud SQL to be made in Stage 3 planning.
```

---

## FILE: docs/ACCEPTANCE_CRITERIA.md

```markdown
# ACCEPTANCE_CRITERIA.md — Stage Completion Criteria

## Stage 0: Documentation & Setup

### Acceptance Criteria
- [x] No application code written
- [x] No npm/pnpm installs run
- [x] No GCP resources created or modified
- [x] Current index.html NOT modified
- [x] Frontend decision fixed: Next.js (not Angular)
- [x] Folder/file plan complete and executable
- [x] Agent rules defined and explicit
- [x] Safety boundaries documented
- [x] AGENTS.md created with complete protocol
- [x] README.md created with project overview
- [x] docs/ARCHITECTURE.md created
- [x] docs/CURRENT_STATE.md created
- [x] docs/ROADMAP.md created
- [x] docs/AGENT_PROTOCOL.md created
- [x] docs/TECH_STACK.md created
- [x] docs/DATA_MODEL.md created
- [x] docs/ACCEPTANCE_CRITERIA.md created
- [x] docs/RESOURCE_INVENTORY.md created
- [x] docs/design/APPROVED_DESIGN.md created
- [x] docs/design/approved-index.html copied
- [x] docs/design/DESIGN_SYSTEM.md created
- [x] docs/design/TAILWIND_MAPPING.md created
- [x] .agents/rules/*.md created (all 6 files)
- [x] .agents/skills/*.md created (all 8 files)
- [x] .vscode/settings.json created
- [x] .vscode/extensions.json created
- [x] Firebase project info documented
- [x] Next execution scope explicitly defined

### Sign-Off
Awaiting user approval to proceed to Stage 1.

---

## Stage 1: Next.js Monorepo Scaffold

### Acceptance Criteria
- [ ] pnpm workspace initialized with root package.json
- [ ] pnpm-workspace.yaml configured
- [ ] Turbo configured with turbo.json
- [ ] Root TypeScript config (tsconfig.json)
- [ ] ESLint, Prettier configs created
- [ ] GitHub workflow template created (.github/workflows/)
- [ ] README updated with monorepo structure
- [ ] pnpm install executes successfully
- [ ] turbo build succeeds (with empty apps/packages)
- [ ] All workspace paths recognized
- [ ] No runtime errors
- [ ] Firebase unchanged
- [ ] No secrets in code

### Next Stage
Stage 2: Web MVP Shell (approved design migration)

---

## Stage 2: Web MVP Shell

### Acceptance Criteria
- [ ] Next.js 14+ app created in apps/web/
- [ ] Tailwind CSS configured with custom design tokens
- [ ] Pages created: /, /about, /contact
- [ ] Components created: Header, Hero, Filter, PropertyCard, Form
- [ ] Design pixel-perfect match to approved index.html
- [ ] Mobile responsive (tested on 375px, 768px, 1920px)
- [ ] Forms functional (lead capture)
- [ ] SSR/SSG configured appropriately
- [ ] No console errors or warnings
- [ ] Lighthouse score >90 on all pages
- [ ] All approved design elements preserved
- [ ] No installs/deploys run
- [ ] Firebase unchanged

### Next Stage
Stage 3: SSOT Data Model (Firestore vs SQL decision)

---

## Stage 3: SSOT Data Model

### Acceptance Criteria
- [ ] Firestore OR Cloud SQL chosen and documented
- [ ] All entity models defined
- [ ] Database schema created and reviewed
- [ ] Repository/DAO layer implemented
- [ ] Zod schemas created for all entities
- [ ] CRUD operations implemented and tested
- [ ] Seed data loaded successfully
- [ ] Data relationships working (foreign keys / references)
- [ ] Indexes created for performance queries
- [ ] Backup strategy documented
- [ ] No PII in logs

### Next Stage
Stage 4: Deal Room + TMA MVP

---

## Stage 4: Deal Room + TMA MVP

### Acceptance Criteria
- [ ] Deal Room full-page component created
- [ ] Property objects display in Deal Room
- [ ] Client intent data shows in Deal Room
- [ ] Documents upload/download functional
- [ ] Telegram Mini App SDK integrated
- [ ] TMA routes created (apps/web/app/tma)
- [ ] Push notifications send from API
- [ ] WebSocket real-time updates working
- [ ] API endpoints tested and documented
- [ ] No rate limiting issues
- [ ] Telegram Bot API production credentials stored in Secret Manager

### Next Stage
Stage 5: AI Intake

---

## Stage 5: AI Intake

### Acceptance Criteria
- [ ] Vertex AI project configured
- [ ] Gemini API client created
- [ ] Intake classification working (>80% accuracy)
- [ ] Deal summary generator functional
- [ ] Broker recommendations generated
- [ ] AI interaction logging complete
- [ ] No PII in AI logs
- [ ] Cost monitoring configured
- [ ] Fallback behavior if AI unavailable
- [ ] API latency <2s for intake classification

### Next Stage
Stage 6: Firebase/App Hosting Deployment

---

## Stage 6: Firebase/App Hosting Deployment

### Acceptance Criteria
- [ ] Firebase App Hosting configured
- [ ] GitHub integration connected
- [ ] Environment variables in Secret Manager
- [ ] Frontend deployed to App Hosting
- [ ] API deployed to Cloud Run
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] CI/CD pipeline working (auto-deploy on GitHub push)
- [ ] Staging environment available
- [ ] Production environment stable
- [ ] Monitoring alerts configured
- [ ] Error tracking (Sentry) operational
- [ ] Uptime >99.9%
- [ ] No secrets in code
- [ ] No debug mode in production

### Next Stage
Stage 7: Analytics & Reporting

---

## Stage 7: Analytics & Reporting

### Acceptance Criteria
- [ ] GA4 tracking installed and verified
- [ ] BigQuery datasets created
- [ ] Event logging to BigQuery working
- [ ] Looker Studio dashboards created
- [ ] Daily/weekly reports automated
- [ ] Product metrics tracked:
  - [ ] Lead submissions
  - [ ] Property views
  - [ ] Deal creation rate
  - [ ] Broker handoff success
- [ ] Performance metrics tracked:
  - [ ] Page load times
  - [ ] API response times
  - [ ] Error rates
  - [ ] Uptime
- [ ] User cohort analysis possible
- [ ] Data retention policy documented
- [ ] Export workflows created

### Launch Readiness
- [ ] All stages complete
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Compliance review passed
- [ ] Performance benchmarks met
- [ ] Monitoring and alerts active
- [ ] Runbook and incident procedures documented
```

---

## FILE: docs/RESOURCE_INVENTORY.md

```markdown
# RESOURCE_INVENTORY.md — Project Resources

## GitHub Repository
- **URL**: [To be populated]
- **Integration**: Connected to Firebase App Hosting
- **Branch**: main (production), staging (pre-release)
- **Status**: Not yet a Next.js app (first rollout failed)

## Firebase Project
- **Name**: KVARTAL Dev
- **ID**: kvartal-dev
- **Number**: 544286782827
- **Region**: europe-west4
- **Services**:
  - [x] Firebase Authentication
  - [x] App Hosting (kvartal-web-dev)
  - [ ] Cloud Firestore (awaiting Stage 3)
  - [ ] Cloud Storage (awaiting Stage 2+)
  - [ ] Cloud Functions (awaiting Stage 4+)
  - [ ] Firebase Realtime Database (optional)
  - [ ] Firebase Remote Config (optional)

## Google Cloud Resources
- **Project ID**: kvartal-dev
- **Billing Account**: [To be configured]
- **Enabled APIs**:
  - [ ] Cloud Run API (awaiting Stage 1+)
  - [ ] Cloud Storage API (awaiting Stage 2+)
  - [ ] Vertex AI API (awaiting Stage 5)
  - [ ] BigQuery API (awaiting Stage 7)
  - [ ] Cloud Secret Manager API
  - [ ] Cloud Logging API
  - [ ] Cloud Monitoring API

## External Services
- **Telegram Bot**: [Bot token in Secret Manager]
- **Email Service**: [To be configured in Stage 2+]
- **SMS Service**: [To be configured for verification]
- **Payment Gateway**: [To be configured for monetization]

## Domain & DNS
- **Primary Domain**: [To be registered]
- **SSL**: Google-managed (Firebase/Cloud Run)
- **DNS Provider**: [To be configured]

## Secrets & Credentials (Google Secret Manager)
- [ ] Firebase Service Account (JSON)
- [ ] Telegram Bot Token
- [ ] API Keys (Google Cloud)
- [ ] Database Credentials (if Cloud SQL)
- [ ] Stripe API Key (if applicable)
- [ ] GitHub Personal Access Token (CI/CD)

## Development Environment
- **Primary**: VS Code + GitHub Copilot
- **Node.js**: 18.x LTS
- **Package Manager**: pnpm 8.x+
- **Build Tool**: Turbo
- **Language**: TypeScript

## Monitoring & Observability
- **Logs**: Google Cloud Logging
- **Metrics**: Google Cloud Monitoring
- **Error Tracking**: Sentry (post-Stage 1)
- **Analytics**: GA4 + BigQuery (Stage 7)
- **Uptime Monitoring**: StatusPage (optional)

## Compliance & Security
- **Auth**: Firebase Authentication
- **App Check**: Firebase App Check
- **Secrets**: Google Secret Manager
- **Audit**: Cloud Audit Logs
- **Data Residency**: europe-west4
- **GDPR**: Data processing agreement signed
- **SOC2**: Pending after MVP

## Deployment Targets
- **Frontend**: Firebase App Hosting (production)
- **API**: Cloud Run (production)
- **Staging**: Firebase App Hosting (staging environment)
- **Database**: Firestore or Cloud SQL (decision pending)

## Backup & Disaster Recovery
- **Database Backups**: [To be configured]
- **Document Storage**: Cloud Storage with versioning
- **Git Backups**: GitHub (public or private)
- **RTO**: [To be defined]
- **RPO**: [To be defined]

## Cost Estimates (Preliminary)
| Service | Estimated Monthly | Notes |
|---------|------------------|-------|
| Firebase App Hosting | $0-50 | Auto-scales with traffic |
| Cloud Run (API) | $20-200 | Pay-per-request |
| Firestore | $10-100 | Usage-based |
| Cloud Storage | $5-50 | Storage + egress |
| Vertex AI | $10-50 | Usage-based |
| BigQuery | $5-20 | Query-based |
| **Total** | **$50-470** | Scales with usage |

## Current Status
- [x] Firebase project created
- [x] App Hosting backend configured (kvartal-web-dev)
- [x] First rollout attempted (FAILED - not Next.js app yet)
- [ ] GitHub repository configured
- [ ] Domain configured
- [ ] Secrets created
- [ ] Additional APIs enabled
- [ ] Monitoring configured
- [ ] Backup configured

## Action Items
1. Do NOT deploy or modify Firebase until Stage 1/2 approval
2. Do NOT create Cloud Run services until Stage 2+
3. Do NOT enable Vertex AI until Stage 5 planning
4. Do NOT configure BigQuery until Stage 7 planning
```

---

## FILE: docs/design/APPROVED_DESIGN.md

```markdown
# APPROVED_DESIGN.md

## Approved Design Reference

**File**: C:\Dev\Kvartal\index.html  
**Status**: ✅ APPROVED - Never modify this file  
**Backup**: docs/design/approved-index.html (reference copy)  
**Usage**: Reference for Next.js component migration  

## Design Preservation Rules

1. **Original Untouched**: C:\Dev\Kvartal\index.html is the source of truth
2. **Reference Copy**: docs/design/approved-index.html is for analysis only
3. **Migration Target**: Stage 2 converts design to Next.js + Tailwind
4. **Pixel-Perfect**: Final Next.js version must match approved design visually
5. **Responsive**: All breakpoints preserved (mobile, tablet, desktop)

## Design Components Identified

### Navigation
- **Header** (sticky, 78px height)
  - Logo + brand
  - Main navigation (uppercase, 13px, 800 weight)
  - Phone number
  - CTA button (primary action)
  - Mobile menu toggle

### Hero Section
- **Eyebrow**: "Коммерческая недвижимость в Москве"
- **Headline**: Product lead
- **CTA Buttons**: Primary + Ghost variants
- **Stats**: 3 key metrics with labels
- **Sidebar**: Lead capture form

### Filter Panel
- Multiple input fields (select, text, range)
- Apply/reset buttons
- Responsive grid layout

### Property Cards
- Image
- Address + district
- Key details (area, price, type)
- CTA button

### Form Elements
- Input fields (text, select, checkbox)
- Lead capture form
- Validation feedback
- Success/error messages

## Design Tokens (CSS Variables)

See docs/design/DESIGN_SYSTEM.md for complete token list.

## Tailwind Mapping

See docs/design/TAILWIND_MAPPING.md for Tailwind CSS configuration.

## Migration Strategy

**Stage 2 Approach**:
1. Create Next.js pages mirroring HTML structure
2. Implement Server Components for static content
3. Create Client Components for interactive elements
4. Use Tailwind CSS with custom design tokens
5. Reuse components across pages and TMA
6. Test responsive design at all breakpoints
7. Lighthouse performance checks
8. A/B test with current design (if live)

## Files to Preserve
- Colors and color scheme
- Typography and font sizes
- Spacing and border-radius
- Component layout and structure
- Form behavior and validation
- Mobile responsiveness

## Known Limitations
- Current design is HTML/CSS only (no dynamic data)
- Form is static (no backend integration)
- No real property data
- No filtering logic implemented
- No real-time updates

## Next Steps
Stage 2: Migrate to Next.js + Tailwind CSS
```

---

## FILE: docs/design/DESIGN_SYSTEM.md

```markdown
# DESIGN_SYSTEM.md — Design Tokens

## Colors (From approved index.html)

### Primary
- **Navy**: #071d3a (darkest, primary brand)
- **Navy-2**: #0d2e58 (secondary dark)

### Accent
- **Red**: #c73333 (primary accent, hover states)
- **Red-Dark**: #9f2525 (darker red for active states)

### Neutral
- **Ink**: #142033 (text, darkest)
- **Muted**: #697386 (secondary text, labels)
- **Line**: #dbe2ea (borders, dividers)
- **White**: #ffffff (backgrounds, text on dark)

### Background
- **BG**: #f4f6f8 (default page background)
- **BG-Warm**: #f7f3ec (warm page sections)

### Shadow
- Default shadow: 0 20px 60px rgba(7, 29, 58, 0.14)

## Typography

### Font Family
- Primary: "Segoe UI", Arial, sans-serif
- Line-height: 1.55

### Font Sizes
- Headline: 30px+
- Section title: 24px+
- Body: 14px-16px
- Small: 13px
- Tiny: 10px-11px

### Font Weights
- Normal: 400
- Bold: 600-700
- Extra Bold: 800

## Spacing

- Border-radius: 18px (default)
- Container width: 1180px (1180px wide with padding)
- Padding: 40px side margins (20px * 2 = 40px from screen edge)
- Grid gaps: 24px, 20px, 12px (various)

## Components

### Header
- Height: 78px sticky
- Background: rgba(255, 255, 255, 0.94) with 14px blur
- Border: 1px solid rgba(navy, 0.1)

### Buttons
- **Primary**: Navy background, white text, red underline hover
- **Ghost**: Transparent, navy text, red underline hover
- **Secondary**: Outlined style
- Border-radius: 10px

### Form Fields
- Borders: 1px solid #dbe2ea
- Padding: 12px 16px
- Border-radius: 10px
- Focus: red border

### Cards
- Background: white or background color
- Border-radius: 18px
- Shadow: 0 20px 60px rgba(navy, 0.14)
- Padding: 24px

## Responsive Breakpoints

- **Mobile**: <768px
- **Tablet**: 768px-1024px
- **Desktop**: >1024px

## Accessibility

- Color contrast: 4.5:1 minimum (WCAG AA)
- Focus indicators: Red underline
- Semantic HTML preserved
- ARIA labels used appropriately

## Motion & Animation

- Smooth scroll behavior
- Link underline animation (0.2s ease)
- Transitions on hover states
- No jarring movements

## References
- Original file: C:\Dev\Kvartal\index.html
- Reference copy: docs/design/approved-index.html
- CSS variables defined in <style> tag (lines 12-28)
```

---

## FILE: docs/design/TAILWIND_MAPPING.md

```markdown
# TAILWIND_MAPPING.md — Design Tokens to Tailwind

## Custom Tailwind Configuration

Use exact custom colors, not default Tailwind palette.

### Color Tokens

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#071d3a',
          light: '#0d2e58',
        },
        red: {
          DEFAULT: '#c73333',
          dark: '#9f2525',
        },
        gold: '#c9a66b',
        ink: '#142033',
        muted: '#697386',
        line: '#dbe2ea',
        bg: {
          DEFAULT: '#f4f6f8',
          warm: '#f7f3ec',
        },
      },
      spacing: {
        container: '1180px',
      },
      borderRadius: {
        DEFAULT: '18px',
        button: '10px',
      },
      boxShadow: {
        default: '0 20px 60px rgba(7, 29, 58, 0.14)',
      },
    },
  },
};
```

### Component Examples

```html
<!-- Primary Button -->
<button class="bg-navy text-white rounded-button px-6 py-3 hover:bg-red">
  Primary Action
</button>

<!-- Ghost Button -->
<button class="bg-transparent text-navy border border-line rounded-button px-6 py-3 hover:border-red">
  Secondary Action
</button>

<!-- Card -->
<div class="bg-white rounded-lg shadow-default p-6">
  Card content
</div>

<!-- Header -->
<header class="sticky top-0 z-50 bg-white/94 backdrop-blur-lg border-b border-navy/10">
  Header content
</header>
```

### Color Reference

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| Navy | #071d3a | navy | Primary brand, text |
| Navy-2 | #0d2e58 | navy-light | Secondary dark |
| Red | #c73333 | red | Accent, hover, links |
| Red-Dark | #9f2525 | red-dark | Active states |
| Gold | #c9a66b | gold | Highlights, badges |
| Ink | #142033 | ink | Body text |
| Muted | #697386 | muted | Secondary text |
| Line | #dbe2ea | line | Borders |
| White | #ffffff | white | Backgrounds |
| BG | #f4f6f8 | bg | Page background |
| BG-Warm | #f7f3ec | bg-warm | Section background |

### No Approximations

❌ **DO NOT** use Tailwind defaults:
- `bg-slate-900` (not navy)
- `text-gray-500` (not muted)
- `border-gray-200` (not line)
- `shadow-lg` (not custom shadow)
- `rounded-lg` (not border-radius)

✅ **DO** use custom tokens:
- `bg-navy`
- `text-muted`
- `border-line`
- `shadow-default`
- `rounded-[18px]`

### Responsive Design

```html
<!-- Mobile first -->
<div class="px-5 md:px-10 lg:px-20">
  Container with responsive padding
</div>

<nav class="hidden md:flex">
  Desktop navigation (hidden on mobile)
</nav>

<button class="md:hidden">
  Mobile menu toggle
</button>
```

### Implementation Checklist
- [x] Design tokens extracted
- [ ] tailwind.config.js created
- [ ] Custom CSS variables defined
- [ ] Components use custom tokens
- [ ] No default Tailwind colors used (except white/transparent)
- [ ] Responsive breakpoints tested
- [ ] Design pixel-perfect in Next.js

---

**Design source**: C:\Dev\Kvartal\index.html  
**Migration target**: apps/web/ (Stage 2)  
**Completion**: All components match approved design
```

---

## FILE: .agents/rules/00-core-rules.md

```markdown
# 00-CORE-RULES.md — Core Rules for All Agents

## Mandate

Develop KVARTAL real estate brokerage platform for Moscow and Dubai markets.
Framework: Next.js + React + TypeScript.
Hosting: Firebase App Hosting + Cloud Run.

## Safe Mode

Every task must follow safe mode:

1. **Plan First**: Every task = plan → approval → execution
2. **No Destructive Changes**: Never delete, overwrite, or break existing files
3. **No Cloud Changes**: No GCP, Firebase, Cloud Run changes without explicit approval
4. **No Secrets in Code**: All secrets go to Secret Manager
5. **No Surprises**: All scope must be approved before execution
6. **Update CURRENT_STATE**: After every execution, update docs/CURRENT_STATE.md
7. **Report Always**: Every execution ends with: files changed, commands run, tests run, known issues

## Non-Negotiable Rules

1. ✅ **index.html is Sacred**: C:\Dev\Kvartal\index.html is NEVER modified, formatted, deleted, or touched
2. ✅ **Next.js Only**: No Angular, Svelte, Vue, or other frameworks for frontend
3. ✅ **Google-First**: Firebase App Hosting is primary production hosting (not Vercel)
4. ✅ **SSOT in Backend**: Property objects live in project database, NOT external CRM
5. ✅ **No Installs Without Approval**: npm install / pnpm install only after planning
6. ✅ **No Deploy Without Approval**: All cloud deployments need explicit sign-off
7. ✅ **Plan-First Always**: Exception: "execution mode" explicitly marked in request

## Task Execution Protocol

### Before Starting
- [ ] Request is in "plan mode" or "execution mode"?
- [ ] If plan mode: create detailed plan, present for approval
- [ ] If execution mode: execute approved plan only
- [ ] Confirm all constraints understood

### During Execution
- [ ] Create files (don't delete)
- [ ] Edit files carefully (preserve context)
- [ ] Run commands (document all)
- [ ] Run tests (if applicable)
- [ ] Check for errors
- [ ] Do NOT deploy without approval

### After Execution
- [ ] List files created/modified
- [ ] List commands run
- [ ] List tests run
- [ ] Identify known issues
- [ ] Update docs/CURRENT_STATE.md
- [ ] Report to user

## Project Structure

```
C:\Dev\Kvartal\
├── docs/                    # Documentation
├── .agents/                 # Agent rules and skills
├── .vscode/                 # VS Code config
├── apps/                    # Monorepo apps (future)
├── services/                # Backend services (future)
├── packages/                # Shared packages (future)
├── index.html              # ✅ APPROVED DESIGN (NEVER TOUCH)
├── AGENTS.md               # Agent definitions
└── README.md               # Project overview
```

## Reporting Template

After every execution, use this format:

```
# Execution Report: [Task Name]

## Summary
[Brief description of what was done]

## Files Created
- file1.md
- file2.ts
- etc.

## Files Modified
- file3.md (changed X)

## Files Copied
- index.html → docs/design/approved-index.html

## Commands Run
```bash
npm install
npm run build
```

## Tests Run
```bash
npm test
```

## Confirmation
✅ index.html NOT modified
✅ No installs run without approval
✅ No cloud deployments
✅ No secrets in code
✅ docs/CURRENT_STATE.md updated

## Known Issues
- Issue 1: description
- Issue 2: description

## Next Recommended Step
[What should happen next]
```

## Status Tracking

All work tracked in docs/CURRENT_STATE.md:
- Current stage
- Completed tasks
- In-progress work
- Blockers
- Next actions

## Approval Workflow

```
Request (User) 
    ↓
Plan (Agent) 
    ↓
Review (User) 
    ↓
Approval (User) 
    ↓
Execution (Agent) 
    ↓
Report (Agent) 
    ↓
Verification (User)
```

## Firebase Project (DO NOT TOUCH)

- Project: kvartal-dev
- App Hosting: kvartal-web-dev
- Region: europe-west4
- First rollout: FAILED (waiting for Next.js)
- Action: Do NOT modify until Stage 2+ approval

## Google-First Stack

- **Frontend**: Firebase App Hosting
- **Backend**: Cloud Run
- **Database**: Firestore or Cloud SQL (Stage 3 decision)
- **Storage**: Cloud Storage
- **Auth**: Firebase Auth
- **AI**: Vertex AI + Gemini
- **Analytics**: GA4 + BigQuery
- **Secrets**: Secret Manager
- **Observability**: Cloud Logging + Monitoring

## Escalation

If unclear:
- Ask user for clarification
- Do NOT guess or assume
- Do NOT proceed with uncertain scope
- Wait for explicit approval

---

**Version**: Stage 0
**Last Updated**: 2026-05-20
**Status**: Active
```

---

[Continue with .agents/rules files and .agents/skills files in subsequent sections...]

---

## TO EXTRACT ALL FILES:

1. Create directories (see extraction instructions above)
2. For each `FILE:` section, copy the content between triple backticks into a new file
3. Save each file in the location specified in the FILE: header
4. Result: Complete Stage 0 setup with all docs, agent rules, and skills

---

**Total Files in This Document**: 31 files + setup scripts
**Location**: C:\Dev\Kvartal\ (root) and subdirectories
**Time to Extract**: ~30-45 minutes (manual) or ~5 minutes (automated)
