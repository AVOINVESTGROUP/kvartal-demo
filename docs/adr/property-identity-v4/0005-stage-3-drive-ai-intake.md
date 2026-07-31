# ADR 0005: Property Identity v4 Stage 3 Drive and AI intake

Date: 2026-07-25
Status: completed locally; external runtime calls and deployment not performed

## Decision

The existing Google Drive/Gemini extraction mechanism now has a registry-aware destination:

```text
author-owned registration submission
→ secure Drive folder intake
→ restricted PropertyIntakeSubmission
→ reviewable PropertyAIDraft
→ explicit author apply
→ deterministic identity check
→ explicit author confirmation
```

It never creates a `PropertyObject`, identifier claim or canonical identity directly.

## Secure registry route

The actor-aware route is:

```http
POST /api/v1/admin/property-identity/submissions/:id/process-drive-folder
```

It requires:

- Firebase `ActorContext` authentication;
- the active author of the exact submission;
- a nonterminal submission state;
- `Idempotency-Key`;
- an effective registry rollout already used to create the submission.

The existing legacy Drive route is unchanged while rollout is disabled. When rollout is enabled, that route cannot create a new object and directs users to the registry submission flow.

## Storage and provenance

Registry Drive intake stores:

- restricted Drive file references in `PropertyIntakeSubmission`;
- extracted non-identity listing/physical-field proposals in `PropertyAIDraft`;
- missing-field and clarification metadata;
- extraction provenance events;
- the intake/draft references on the registration submission.

Downloaded bytes remain ephemeral in the extraction request. This stage does not publish files and does not create public media.

## AI guardrails

- AI output is a proposal, never a final write.
- Applying the draft requires a separate author action with `If-Match` and `Idempotency-Key`.
- Applying a draft invalidates previous check eligibility by changing the identity hash and returning the submission to `DRAFT` or `NEEDS_CORRECTION`.
- AI cannot create, link, publish or cancel a canonical object.
- Identifier-like fields such as cadastral numbers are removed from the plaintext AI proposal before persistence.
- Official identifiers are accepted only through the encrypted observation flow and authority policy.
- The author UI explicitly separates AI suggestions from authoritative identifiers.

## Verification

The disposable PostgreSQL integration suite verifies that:

- an AI draft is attached only to the author submission;
- applying it copies only allowlisted physical/listing fields;
- the author action updates the row version and audit history;
- a cadastral-number-like AI field is absent from both the stored proposal and applied identity input;
- the AI draft becomes `approved` only after the author action.

No real Drive, Gemini, production database, GCP, Firebase or deployment call was made during tests.
