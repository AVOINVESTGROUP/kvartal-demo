# ⚠️ FOLDER STRUCTURE READY TO EXTRACT

**Status:** Folders can be manually created OR use provided extraction scripts  
**Total Folders:** 6 main directories  
**Total Files:** 13 markdown files + 2 config files  

---

## Folder Structure (Create These Manually)

```
C:\Dev\Kvartal\
├── .agents/
│   ├── rules/
│   └── skills/
│
├── .vscode/
│
├── docs/
│   └── design/
│
├── infra/
│   ├── gcp/
│   └── firebase/
│
├── [Root documentation files]
└── index.html (approved design reference)
```

---

## Files to Create in Each Folder

### `.agents/rules/` (Core Rules)
Create these files with the content provided in `.agents-RULES-CONTENT.md`:

1. `00-core-rules.md` — Hard rules, execution checklist, escalation
2. `01-kvartal-ssot-principle.md` — SSOT boundary, backend ↔ CRM
3. `02-two-market-architecture.md` — Moscow vs Dubai differences
4. `03-deal-room-state-machine.md` — 5 states, transitions, events
5. `04-compliance-guardrails.md` — AI limits, consent gates, data residency
6. `05-step-by-step-execution.md` — Execution discipline, validation

### `.agents/skills/` (Domain Knowledge)
Create these files with the content provided in `.agents-SKILLS-CONTENT.md`:

1. `kvartal-architecture-design.skill.md` — Already in root, move here
2. `kvartal-deal-room-implementation.skill.md` — Deal room patterns
3. `kvartal-data-modeling.skill.md` — Schema design, migrations
4. `kvartal-ai-integration.skill.md` — Gemini, confidence model, guardrails
5. `kvartal-partner-layer.skill.md` — Handoff, SLA, verification
6. `kvartal-compliance-review.skill.md` — RU/UAE/DLD audits

### `.vscode/` (VS Code Configuration)
Create these files:

1. `settings.json` — Workspace settings (format on save, TypeScript, etc.)
2. `extensions.json` — Recommended extensions (Google Cloud Code, ESLint, Prettier, etc.)

### `docs/` (Architecture Documentation)
Create these files in `docs/`:

1. `00-OVERVIEW.md` — System design (already created in root as `docs-00-KVARTAL-OVERVIEW.md`)
2. `01-ARCHITECTURE.md` — System diagram, integration points
3. `02-DATA-MODEL.md` — Entities, schemas, migrations
4. `03-API-CONTRACTS.md` — OpenAPI 3.0 endpoints
5. `04-MVP-SCOPE.md` — Phase breakdown, included/excluded
6. `05-DEAL-ROOM-SPEC.md` — State machine, events, UI
7. `06-AI-SYSTEM.md` — Confidence model, guardrails, training
8. `07-PARTNER-LAYER.md` — Handoff, SLA, verification
9. `08-COMPLIANCE-PLAN.md` — RU/UAE/DLD requirements
10. `09-DEPLOYMENT.md` — CI/CD, monitoring, backups
11. `10-CURRENT-STATE.md` — Live status document (update after each phase)

### `docs/design/` (Design Reference)
Create these files:

1. `APPROVED_DESIGN.md` — Design reference documentation
2. `approved-index.html` — Copy of root index.html (reference only)
3. `DESIGN_SYSTEM.md` — Design tokens, colors, spacing
4. `TAILWIND_MAPPING.md` — Tailwind CSS token mapping

### Root Directory (Keep Only Essential)

**KEEP IN ROOT:**
- `AGENTS.md` — Agent definitions
- `README.md` — Project overview
- `index.html` — Approved design reference
- `CLAUDE_COPILOT_OPERATING_SYSTEM.md` — AI operating manual
- `.gitignore` (when repo is initialized)
- `.env.example` (when needed)

**DELETE FROM ROOT** (temporary/utility files):
- `setup-stage0.py` — Workaround for environment constraints
- `setup-stage0.bat` — Workaround for environment constraints
- `setup-stage0.ps1` — Workaround for environment constraints
- `extract-stage0.py` — Workaround for environment constraints
- `setup-complete.py` — Workaround for environment constraints
- `KVARTAL_STAGE_0_ALL_FILES.md` — Master content file (kept for reference, can delete after extraction)
- `STAGE_0_SETUP_GUIDE.md` — Setup instructions (archive to docs/archived/)
- `STAGE_0_EXECUTION_REPORT.md` — Execution report (archive to docs/archived/)

**MOVE TO `docs/`:**
- `docs-00-KVARTAL-OVERVIEW.md` → `docs/00-OVERVIEW.md`
- `KVARTAL_DOCUMENTATION_ARCHITECTURE.md` → `docs/STRUCTURE.md`
- `PHASE_1_READY.md` → `docs/PHASE_1_DECISIONS.md`
- `SESSION_SUMMARY.md` → `docs/SESSION_SUMMARY.md`
- `SKILL-kvartal-architecture-design.md` → `.agents/skills/kvartal-architecture-design.skill.md`

**OPTIONAL ARCHIVE (if keeping history):**
- Create `docs/archived/` folder
- Move: `STAGE_0_SETUP_GUIDE.md`, `STAGE_0_EXECUTION_REPORT.md`, `KVARTAL_STAGE_0_ALL_FILES.md`

---

## Action Items

### User (You)
1. Create the 6 main folders (`.agents/rules`, `.agents/skills`, `.vscode`, `docs/design`, `infra/gcp`, `infra/firebase`)
2. Review files-to-move list above
3. Let me know if structure looks good

### Me (Claude)
After folders exist:
1. Create content files in each directory
2. Move existing docs into proper locations
3. Remove clutter from root
4. Provide clean file tree

---

## Quick Manual Setup (If You Prefer)

```bash
# Windows Command Prompt or PowerShell
mkdir C:\Dev\Kvartal\.agents\rules
mkdir C:\Dev\Kvartal\.agents\skills
mkdir C:\Dev\Kvartal\.vscode
mkdir C:\Dev\Kvartal\docs\design
mkdir C:\Dev\Kvartal\infra\gcp
mkdir C:\Dev\Kvartal\infra\firebase
```

Then confirm, and I'll organize all the files.

---

**Next:** 
- Confirm structure looks good
- Let me know if you want me to wait for folders to be created manually, or if you want me to proceed with a different approach
- I'll clean up root and organize docs into proper locations
