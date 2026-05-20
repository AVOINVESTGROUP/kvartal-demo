[ARCHIVED — NOT CURRENT]
# рџљЂ SETUP INSTRUCTIONS: Manual Folder Organization

**Goal:** Create proper project structure by moving files  
**Time:** 5 minutes  
**Method:** Manual folder creation + file moving  

---

## Step 1: Create Folders (Windows Explorer)

Open File Explorer and create these folders in `C:\Dev\Kvartal\`:

```
.agents/rules/
.agents/skills/
.vscode/
docs/design/
docs/archived/
infra/gcp/
infra/firebase/
scripts/
```

Or use Command Prompt:
```batch
cd C:\Dev\Kvartal
mkdir .agents\rules .agents\skills .vscode docs\design docs\archived infra\gcp infra\firebase scripts
```

---

## Step 2: Move Files

After folders are created, move these files:

### Move to `docs/`:
- `docs-00-KVARTAL-OVERVIEW.md` в†’ `docs/00-OVERVIEW.md`
- `KVARTAL_DOCUMENTATION_ARCHITECTURE.md` в†’ `docs/STRUCTURE.md`
- `PHASE_1_READY.md` в†’ `docs/PHASE_1_DECISIONS.md`
- `SESSION_SUMMARY.md` в†’ `docs/SESSION_SUMMARY.md`

### Move to `.agents/skills/`:
- `SKILL-kvartal-architecture-design.md` в†’ `.agents/skills/kvartal-architecture-design.skill.md`

### Move to `docs/archived/`:
- `STAGE_0_SETUP_GUIDE.md`
- `STAGE_0_EXECUTION_REPORT.md`
- `KVARTAL_STAGE_0_ALL_FILES.md`

### Delete (Garbage):
- `setup-stage0.py`
- `setup-stage0.bat`
- `setup-stage0.ps1`
- `extract-stage0.py`
- `setup-complete.py`

---

## Step 3: Keep in Root

These files stay in `C:\Dev\Kvartal\`:
- вњ… `AGENTS.md` вЂ” Agent definitions
- вњ… `README.md` вЂ” Project overview
- вњ… `index.html` вЂ” Approved design reference
- вњ… `CLAUDE_COPILOT_OPERATING_SYSTEM.md` вЂ” AI operating system
- вњ… `.gitignore` вЂ” Git configuration (create when initializing repo)
- вњ… `create-structure.py` вЂ” Script (can delete after use)
- вњ… `create-structure.bat` вЂ” Script (can delete after use)

---

## Result: Clean Root Directory

After moving files, your root should look like this:

```
C:\Dev\Kvartal\
в”њв”Ђв”Ђ .agents/
в”‚   в”њв”Ђв”Ђ rules/  [will be populated next]
в”‚   в””в”Ђв”Ђ skills/
в”‚       в””в”Ђв”Ђ kvartal-architecture-design.skill.md
в”њв”Ђв”Ђ .vscode/  [will be populated next]
в”њв”Ђв”Ђ docs/
в”‚   в”њв”Ђв”Ђ archived/
в”‚   в”‚   в”њв”Ђв”Ђ STAGE_0_SETUP_GUIDE.md
в”‚   в”‚   в”њв”Ђв”Ђ STAGE_0_EXECUTION_REPORT.md
в”‚   в”‚   в””в”Ђв”Ђ KVARTAL_STAGE_0_ALL_FILES.md
в”‚   в”њв”Ђв”Ђ design/  [will be populated next]
в”‚   в”њв”Ђв”Ђ 00-OVERVIEW.md
в”‚   в”њв”Ђв”Ђ STRUCTURE.md
в”‚   в”њв”Ђв”Ђ PHASE_1_DECISIONS.md
в”‚   в””в”Ђв”Ђ SESSION_SUMMARY.md
в”њв”Ђв”Ђ infra/
в”‚   в”њв”Ђв”Ђ gcp/
в”‚   в””в”Ђв”Ђ firebase/
в”њв”Ђв”Ђ scripts/
в”њв”Ђв”Ђ AGENTS.md
в”њв”Ђв”Ђ README.md
в”њв”Ђв”Ђ index.html
в””в”Ђв”Ђ CLAUDE_COPILOT_OPERATING_SYSTEM.md
```

---

## Verification Checklist

After moving files, verify:

- [ ] `.agents/skills/` contains `kvartal-architecture-design.skill.md`
- [ ] `docs/` contains 4 files: `00-OVERVIEW.md`, `STRUCTURE.md`, `PHASE_1_DECISIONS.md`, `SESSION_SUMMARY.md`
- [ ] `docs/archived/` contains 3 files (Stage 0 docs)
- [ ] Root has NO `setup-stage0.*` files (deleted)
- [ ] Root has NO `extract-stage0.py` (deleted)
- [ ] Root has only 4 essential files: `AGENTS.md`, `README.md`, `index.html`, `CLAUDE_COPILOT_OPERATING_SYSTEM.md`

---

## After Moving Files

Once complete, reply with:
- вњ… "Done" or
- вњ… "Folders created, files moved, ready for next step"

Then I will:
1. Create content files in `.agents/rules/` (6 rules files)
2. Create content files in `.agents/skills/` (5 more skill files)
3. Create config files in `.vscode/` (settings.json, extensions.json)
4. Create docs in `docs/design/` (design reference files)
5. Provide the final clean project structure

---

**Time to complete:** ~5 minutes  
**Difficulty:** Easy (drag-and-drop in File Explorer)  
**Next:** Reply when done, and I'll populate remaining files

