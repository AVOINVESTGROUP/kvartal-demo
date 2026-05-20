---
id: kvartal-architecture-design
type: skill
version: 1.1
status: active
last_updated: 2026-05-20
related: [docs/01-ARCHITECTURE.md]
---

# Skill: KVARTAL Architecture & Design

**Owner:** Claude Copilot (Primary Architect)  
**Specialty:** Multi-market platform design, deal room mechanics, compliance layers  
**Input:** Requirements, user flows, data model decisions  
**Output:** Architecture diagrams, tech stack justification, API contracts, database schemas  

---

## When to Invoke This Skill

- Designing new features across Moscow/Dubai markets
- Creating API contracts for backend/frontend/partner integration
- Defining data model changes (PropertyObject, Listing, DealRoom extensions)
- Analyzing architectural risks (compliance, SSOT violations, CRM boundaries)
- Making tech stack decisions (database choice, message queue, AI service isolation)
- **BEFORE ANY CODING:** Architecture review to prevent rework

---

## Working Principles

1. **SSOT as Core Constraint:** Every decision filters through "does this preserve backend SSOT ownership of objects?"
   - Backend: Objects, units, listings, investment snapshots
   - CRM: Leads, deals, tasks, communication, broker notes
   - Never reverse this boundary

2. **Request-First Lens:** Never suggest UI/features that assume large catalog; think small, curated, AI-driven
   - MVP: 5 Moscow objects + limited Dubai via partners
   - User flow: Task → AI qualification → curated shortlist → deal room
   - Not: Homepage catalog browse → filter → result

3. **Market Awareness:** Moscow (commercial, documentation-heavy) ≠ Dubai (investment, partner-driven)
   - Never one-size-fits-all; always document market-specific field/rules
   - Example: Moscow = building status + docs; Dubai = developer + payment plan + yield

4. **State Machine Thinking:** All entities are state machines; define states, transitions, side effects upfront
   - Deal room: draft → sent → viewed → active → closed
   - Partner handoff: assigned → accepted → contacted → shortlist → viewing → offer → closed
   - CI/CD: pending → in_progress → done / blocked

5. **Compliance-First:** Every feature audit includes RU PII law, UAE/Dubai ad permits, DLD requirements
   - Can't launch without: PII residency, consent gates, partner data scoping
   - All investment claims must have confidence + source + disclaimer

---

## Architecture Deliverables

### 1. Architecture Decision Record (ADR)
```markdown
# ADR-NNN: [Decision Title]

## Problem
[What needed to be decided]

## Options Considered
A. [Option 1 + tradeoffs]
B. [Option 2 + tradeoffs]
C. [Option 3 + tradeoffs]

## Decision
We choose [Option X] because:
- [Reason 1]
- [Reason 2]
- [Constraint alignment]

## Consequences
✅ Positive: [benefit]
⚠️ Risk: [mitigation plan]
❌ Blocker: [if any]

## Related Decisions
- ADR-YYY (dependency)
- ADR-ZZZ (related)
```

### 2. Data Model Specification
- Entity definitions (fields, types, constraints, enums)
- Relationships (1:N, M:N, cascading deletes)
- Indexes (performance-critical queries)
- Role-based access control (who sees what)
- Migration strategy (Firestore vs PostgreSQL differences)

### 3. API Contract (OpenAPI 3.0 spec)
- Endpoints: method, path, auth requirements, request/response schemas
- Error codes and fallback behaviors (including AI refusal cases)
- Rate limiting, pagination, filtering
- Webhooks (CRM inbound, TMA callbacks, partner updates)

### 4. Integration Diagram
- Frontend (web, TMA) → Backend (API, auth)
- Backend → CRM (webhook, unidirectional)
- Backend → Partner layer (scoped access)
- Backend → AI service (intent extraction, broker summary)
- Monitoring: Error tracking, metrics, audit logs

### 5. Compliance Checklist
- RU PII constraints (data residency, encryption, access logs)
- UAE/Dubai ad permit requirements (cold calling restrictions, ORN verification)
- Partner data access boundaries (what they can/cannot see)
- GDPR/CCPA consent gates (separate intents for marketing, partner transfer)
- Audit trail requirements (who changed what, when, why)

---

## Example: Designing the "Deal Room Update" Flow

**User Request:** "Broker adds comment to deal room object; client sees it in TMA in real-time"

**Architecture Work:**

### 1. State Management
- Deal room state stays at (sent, viewed, active, closed) — comments don't change state
- Comment is **immutable event** (DealRoomEvent, event-sourced)
- TMA subscribes to room updates via WebSocket

### 2. Data Model Impact
```sql
CREATE TABLE dealroom_events (
  id UUID PRIMARY KEY,
  dealroom_id UUID FOREIGN KEY,
  event_type ENUM ('object_added', 'comment_added', 'status_changed', 'participant_joined'),
  actor_id UUID, -- broker_id or system
  actor_type ENUM ('broker', 'client', 'system'),
  metadata JSONB, -- { object_id, comment_text, visibility: 'all'|'broker_only' }
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  INDEX (dealroom_id, created_at DESC),
  INDEX (actor_id, created_at DESC)
);
```

### 3. API Endpoint Design
```
POST /api/v1/deal-rooms/{room_id}/comments
Authorization: Bearer token (broker role required)
Content-Type: application/json

Request Body:
{
  "object_id": "uuid",
  "text": "string (max 1000 chars)",
  "type": "broker_note" | "client_annotation",
  "visibility": "all" | "broker_only"
}

Response (201):
{
  "event_id": "uuid",
  "dealroom_id": "uuid",
  "timestamp": "2026-05-20T14:30:00Z",
  "room_state": "active",
  "event": {
    "type": "comment_added",
    "object_id": "uuid",
    "text": "...",
    "broker": { "id": "uuid", "name": "John" }
  }
}

Error (403):
{
  "error": "INSUFFICIENT_ROLE",
  "message": "Only brokers can add comments"
}
```

### 4. TMA Integration (Real-Time)
```javascript
// TMA WebSocket subscription
client.subscribe(`dealroom:${roomId}`, (message) => {
  if (message.event_type === 'comment_added' && message.visibility === 'all') {
    // Show notification: "New comment from [Broker]: [preview]"
    // Update UI: append comment to object card
  }
});

// Push notification
sendPushNotification({
  title: "New comment from [Broker]",
  body: message.text.substring(0, 100),
  deepLink: `tma://dealroom/${roomId}/object/${objectId}#comment-${eventId}`
});
```

### 5. Compliance Gate
- **Sanitization:** Remove contact details of other parties (no phone numbers, no CRM IDs visible)
- **Audit Log:** Record actor, timestamp, content hash, visibility setting
- **Access Control:** Comment visible only to deal room participants (role-based)
- **Partner Scoping:** If partner is participant, hide broker internal notes

### 6. CRM Webhook (One-Way)
```
POST https://crm.partner.com/webhook/dealroom-event
Authorization: Bearer crm_webhook_token

Body:
{
  "dealroom_id": "uuid",
  "event_type": "comment_added",
  "event_timestamp": "2026-05-20T14:30:00Z",
  "actor": "broker_id",
  "summary": "Broker added comment to object"
}
```

---

## Common Architectural Patterns

### Pattern 1: Market-Aware API Response
```
GET /api/v1/objects/{id}
Response depends on market + user role:

If market=moscow:
  building_status: string enum
  documents_checklist: [...]
  investment_scenario: {...}

If market=dubai:
  developer: string
  payment_plan: {...}
  yield_estimate: {...}
  service_charges_aed_annual: number
  dld_status: enum

Both:
  _market: 'moscow' | 'dubai'
  _created_at: timestamp
  _created_by: 'partner' | 'admin'
```

### Pattern 2: Investment Snapshot with Source Attribution
```json
{
  "yield_pct": 4.5,
  "yield_confidence": "medium",
  "yield_source": {
    "type": "partner_estimate",
    "partner": "Dubai Partner XYZ",
    "date": "2026-05-20",
    "disclaimer": "Not verified; market cycles apply; historical range 3–6%"
  },
  "service_charges_aed_annual": 35000,
  "service_charges_source": "developer_official_list",
  "risks": [
    {
      "category": "market_cycle",
      "severity": "medium",
      "mitigation": "Diversify across multiple properties"
    }
  ],
  "_verified_at": null,
  "_verified_by": null
}
```

### Pattern 3: AI Fallback UX
```json
{
  "question": "Can this be used for a dental clinic?",
  "ai_response": {
    "confidence": "medium",
    "answer": "Preliminary consideration possible. Requires verification:",
    "checks_needed": [
      {
        "item": "Electrical load capacity",
        "why": "Dental equipment requires 30+ kVA"
      },
      {
        "item": "Utility infrastructure",
        "why": "Hot water, drainage required"
      }
    ],
    "cta": [
      {
        "label": "Ask broker for details",
        "action": "create_support_ticket",
        "context": {
          "reason": "user_question",
          "question_text": "..."
        }
      },
      {
        "label": "Add to shortlist anyway",
        "action": "add_to_dealroom"
      }
    ]
  }
}
```

### Pattern 4: Partner Handoff SLA
```json
{
  "handoff_id": "uuid",
  "state": "assigned",
  "assigned_at": "2026-05-20T10:00:00Z",
  "accepted_at": null,
  "contacted_at": null,
  "last_update_at": "2026-05-20T10:00:00Z",
  
  "sla": {
    "accept_by": "2026-05-20T18:00:00Z",
    "contact_by": "2026-05-21T18:00:00Z",
    "next_escalation_at": "2026-05-20T18:30:00Z"
  },
  
  "status": {
    "state": "assigned",
    "overdue": false,
    "next_milestone": "accept_by_18:00_today"
  }
}
```

---

## Anti-Patterns (What NOT to Design)

❌ **Catalog-First:** "Let's show 100 Moscow buildings, then filter by price"  
→ **Instead:** "User describes task → AI narrows to 2–3 options → broker supplements"

❌ **CRM as Object Store:** "Property objects stored in Bitrix24 custom fields"  
→ **Instead:** "Objects live in KVARTAL backend; CRM link is dealroom_id only"

❌ **One Deal Room State:** "Deal room is just a PDF"  
→ **Instead:** "Deal room is state machine: draft → sent → viewed → active → closed + events"

❌ **Partner Full Access:** "Give partner login to see all Moscow leads"  
→ **Instead:** "Partner sees only assigned handoffs, not other leads or internal notes"

❌ **AI Investment Guarantees:** "Gemini says yield is guaranteed 4%"  
→ **Instead:** "AI says: 'Estimated range 3–5% based on market data; depends on [factors]; not guaranteed'"

❌ **Bidirectional CRM Sync:** "If broker updates deal in CRM, update KVARTAL"  
→ **Instead:** "KVARTAL → CRM only (via webhook); CRM updates must be API calls"

---

## Skill Activation Checklist

Before architecting a feature, confirm:

- [ ] KVARTAL_Base_Document_v1.md has been re-read (within last 2 weeks)
- [ ] User flow (one of 7 defined flows, or documented new flow) is clear
- [ ] Data model impact identified (new entities? new fields? new relationships?)
- [ ] Market differences documented (Moscow-specific? Dubai-specific? Both?)
- [ ] Compliance constraints listed (PII, ad permits, partner access, consent)
- [ ] Stakeholder roles identified (who sees what? who can do what?)
- [ ] SSOT boundary preserved (backend owns objects, CRM owns leads — never reversed)
- [ ] State machine defined (if applicable; all entities have states)
- [ ] Fallback/error cases handled (what if AI fails? what if CRM is down?)
- [ ] Integration points tested (CRM webhook, TMA WebSocket, partner data scoping)

---

## Success Metrics for Architecture

✅ Design **prevents** CRM/SSOT violations (core rule)  
✅ **Every entity has a state machine** defined (even simple ones)  
✅ **Partner access scoped** — partners never see other leads or full objects  
✅ **AI answers marked** with confidence + source + disclaimers  
✅ **Compliance gate included** (consent, audit, sanitization, data residency)  
✅ **Two markets** can implement independently with shared core data model  
✅ **API contracts** are backward-compatible (versioned endpoints)  
✅ **Error cases** have graceful fallbacks (no dead ends for users)  
✅ **Performance** indexes defined for query patterns  

---

## Escalation Paths

If stuck on a decision:

1. **Re-read KVARTAL_Base_Document_v1.md** — Section 19 (MVP scope), Section 7 (deal room)
2. **Ask for clarification** — Use ask_user tool (never guess)
3. **Document blocker** — Update CURRENT_STATE.md with decision point + options
4. **Reference ADRs** — Make decisions explicit; don't hide trade-offs
5. **Involve user early** — Architecture decisions are user's responsibility, not mine

---

**When this skill is active:**  
- I am thinking like an architect (system-level, trade-offs, scalability)
- I am not implementing code yet (that comes after design approval)
- I am protecting SSOT principle and compliance boundaries
- I am asking for user decisions on trade-offs, not deciding myself
