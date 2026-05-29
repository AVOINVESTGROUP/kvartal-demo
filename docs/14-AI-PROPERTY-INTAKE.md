# AI Property Intake Draft

**Date:** 2026-05-28  
**Status:** Draft for owner approval  
**Related:** `docs/00-MASTER-ARCHITECTURE.md`, `docs/02-DATA-MODEL.md`, `docs/03-API-CONTRACTS.md`

## 1. Purpose

Property cards should be created with AI assistance.

The user should be able to provide unstructured or semi-structured information, and the system should extract a structured property draft.

Input examples:

- free text;
- copied messages;
- PDFs;
- cadastral/legal snippets;
- tables;
- photos with captions;
- broker notes;
- owner-provided descriptions;
- investment/project summaries.

The AI should:

- classify the object type;
- extract known fields;
- map details into the relational property model;
- check available open sources for актуальность and plausibility where legally/technically possible;
- identify missing or conflicting data;
- ask clarification questions when needed;
- create a reviewable draft;
- never publish or finalize critical data without human confirmation.

## 2. Core Flow

```text
Office user opens object intake
-> pastes or uploads unstructured data
-> office-api stores raw intake submission
-> AI extraction service creates structured draft
-> optional open-source verification checks public facts
-> system shows extracted fields, confidence, sources, and missing questions
-> user answers clarifying questions / edits draft
-> backend validates draft
-> user confirms save
-> office-api writes PropertyObject + components + attributes + economics
-> audit log records AI extraction and human confirmation
```

## 3. Human-in-the-Loop Rule

AI may draft data, but a human office user must confirm before the data becomes a canonical SSOT record.

AI must not directly:

- publish objects;
- change ownership fields;
- overwrite existing primary object data;
- make legal conclusions;
- guarantee investment returns;
- expose private data to unrelated organizations/offices.

## 4. Proposed Entities

### PropertyIntakeSubmission

Stores the raw user-provided material.

```ts
type PropertyIntakeSubmission = {
  id: string;
  organizationId: string;
  officeId: string;
  createdByUserId: string;
  sourceType: "text" | "file" | "mixed";
  rawText?: string;
  fileRefs?: string[];
  status: "received" | "extracting" | "needs_clarification" | "draft_ready" | "confirmed" | "rejected";
  createdAt: string;
  updatedAt: string;
};
```

### PropertyAIDraft

Stores the extracted structured draft before confirmation.

```ts
type PropertyAIDraft = {
  id: string;
  intakeSubmissionId: string;
  organizationId: string;
  officeId: string;
  createdByUserId: string;
  proposedAssetClass?: string;
  proposedPropertyObject?: Record<string, unknown>;
  proposedComponents?: Array<Record<string, unknown>>;
  proposedAttributes?: Array<Record<string, unknown>>;
  proposedEconomics?: Array<Record<string, unknown>>;
  confidence: "high" | "medium" | "low";
  fieldConfidence?: Record<string, "high" | "medium" | "low">;
  missingFields?: string[];
  conflicts?: string[];
  clarificationQuestions?: string[];
  verificationSummary?: {
    checked: boolean;
    status: "not_checked" | "partially_verified" | "verified" | "conflict_found" | "unsupported";
    notes?: string[];
  };
  status: "draft" | "needs_clarification" | "approved" | "rejected" | "superseded";
  createdAt: string;
  updatedAt: string;
};
```

### PropertyAIExternalCheck

Stores open-source verification results.

```ts
type PropertyAIExternalCheck = {
  id: string;
  intakeSubmissionId: string;
  draftId?: string;
  propertyObjectId?: string;
  organizationId: string;
  officeId: string;
  checkedField: string;
  claimedValue?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourcePublishedAt?: string;
  checkedAt: string;
  result: "confirmed" | "not_found" | "conflict" | "outdated" | "unsupported";
  confidence: "high" | "medium" | "low";
  notes?: string;
};
```

### PropertyAIExtractionEvent

Records AI processing events for auditability.

```ts
type PropertyAIExtractionEvent = {
  id: string;
  intakeSubmissionId: string;
  draftId?: string;
  organizationId: string;
  officeId: string;
  actorUid?: string;
  eventType:
    | "intake_received"
    | "extraction_started"
    | "draft_created"
    | "external_check_started"
    | "external_check_completed"
    | "clarification_requested"
    | "clarification_answered"
    | "draft_approved"
    | "draft_rejected"
    | "property_created_from_draft";
  payload?: Record<string, unknown>;
  createdAt: string;
};
```

## 5. Extraction Targets

AI should map data into:

- `property_objects`;
- `property_object_localizations`;
- `property_object_components`;
- `property_object_attributes`;
- `property_object_economics`;
- `property_media`;
- `property_documents`;
- `audit_logs`.

For simple objects:

```text
land
apartment
house
```

For future complex objects:

```text
factory
industrial_site
development_project
investment_project
mixed_use
```

## 6. Clarification Questions

If required fields are missing or confidence is low, the AI should ask targeted questions.

Examples:

```text
What is the exact cadastral number?
Is the stated area land area or building area?
Is the price fixed or on request?
Who is the information owner office?
Can this object be shown publicly or only inside the office network?
Are the projected income numbers actual, projected, or owner-provided?
What source supports the stated cap rate?
The public source shows a different area. Which value should be used?
The cadastral number was not found in public sources. Can you confirm it?
```

Questions should be stored with the draft so the user can answer them asynchronously.

## 7. Guardrails

- AI output is a draft, not SSOT truth.
- User confirmation is required before writing canonical property records.
- Ownership fields must be set by backend from auth context, not by AI.
- AI may suggest `assetClass`, but backend validation must verify allowed values.
- Economic/investment claims require source and confidence.
- Open-source verification must store source URL/name, check date, result, and confidence.
- Open-source verification can support the broker, but it is not a legal due-diligence conclusion.
- If public data conflicts with user-provided data, the draft must be marked `conflict_found` and require human review.
- Do not scrape or store data from sources where access/use is not allowed.
- No guaranteed return claims.
- Private owner/client data must not be put into public fields.
- Raw intake material and extracted drafts must be access-controlled to the source organization/office.
- All AI extraction and confirmation events must be auditable.

## 8. Service Placement

Initial ownership:

```text
office-api:
  receives intake submissions
  stores drafts
  stores open-source verification results
  validates user confirmation
  writes confirmed property records

AI extraction worker/service:
  can be inside office-api first as an internal module
  may later become separate Cloud Run service if workload grows
```

AI extraction must not bypass `office-api` authorization and validation.

## 9. API Draft

```text
POST /api/v1/admin/property-intakes
GET /api/v1/admin/property-intakes/{id}
POST /api/v1/admin/property-intakes/{id}/extract
POST /api/v1/admin/property-intakes/{id}/verify
GET /api/v1/admin/property-ai-drafts/{draftId}
POST /api/v1/admin/property-ai-drafts/{draftId}/clarifications
POST /api/v1/admin/property-ai-drafts/{draftId}/approve
POST /api/v1/admin/property-ai-drafts/{draftId}/reject
```

Approval creates canonical records only after backend validation.

## 10. Stage Placement

Stage 3 schema should reserve tables for AI intake/drafts/events.

Full AI extraction implementation can be Stage 5, but Stage 3 must not design object creation in a way that blocks AI-assisted intake.

Open-source verification implementation may also be Stage 5, but Stage 3 schema should reserve the verification result table so property drafts can later show source-backed confidence.
