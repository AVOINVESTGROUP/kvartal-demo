# 🚀 SETUP INSTRUCTIONS: Manual Folder Organization

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
- `docs-00-KVARTAL-OVERVIEW.md` → `docs/00-OVERVIEW.md`
- `KVARTAL_DOCUMENTATION_ARCHITECTURE.md` → `docs/STRUCTURE.md`
- `PHASE_1_READY.md` → `docs/PHASE_1_DECISIONS.md`
- `SESSION_SUMMARY.md` → `docs/SESSION_SUMMARY.md`

### Move to `.agents/skills/`:
- `SKILL-kvartal-architecture-design.md` → `.agents/skills/kvartal-architecture-design.skill.md`

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
- ✅ `AGENTS.md` — Agent definitions
- ✅ `README.md` — Project overview
- ✅ `index.html` — Approved design reference
- ✅ `CLAUDE_COPILOT_OPERATING_SYSTEM.md` — AI operating system
- ✅ `.gitignore` — Git configuration (create when initializing repo)
- ✅ `create-structure.py` — Script (can delete after use)
- ✅ `create-structure.bat` — Script (can delete after use)

---

## Result: Clean Root Directory

After moving files, your root should look like this:

```
C:\Dev\Kvartal\
├── .agents/
│   ├── rules/  [will be populated next]
│   └── skills/
│       └── kvartal-architecture-design.skill.md
├── .vscode/  [will be populated next]
├── docs/
│   ├── archived/
│   │   ├── STAGE_0_SETUP_GUIDE.md
│   │   ├── STAGE_0_EXECUTION_REPORT.md
│   │   └── KVARTAL_STAGE_0_ALL_FILES.md
│   ├── design/  [will be populated next]
│   ├── 00-OVERVIEW.md
│   ├── STRUCTURE.md
│   ├── PHASE_1_DECISIONS.md
│   └── SESSION_SUMMARY.md
├── infra/
│   ├── gcp/
│   └── firebase/
├── scripts/
├── AGENTS.md
├── README.md
├── index.html
└── CLAUDE_COPILOT_OPERATING_SYSTEM.md
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
- ✅ "Done" or
- ✅ "Folders created, files moved, ready for next step"

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
