# STAGE_0_SETUP_GUIDE.md - Complete Stage 0 Setup Instructions

## Quick Setup (Two Options)

### Option 1: PowerShell Script (Recommended)
```powershell
cd C:\Dev\Kvartal
powershell -ExecutionPolicy Bypass -File setup-stage0.ps1
```

### Option 2: Batch Script
```batch
cd C:\Dev\Kvartal
setup-stage0.bat
```

### Option 3: Manual (Windows Command Prompt)
```batch
mkdir C:\Dev\Kvartal\docs
mkdir C:\Dev\Kvartal\docs\design
mkdir C:\Dev\Kvartal\.agents
mkdir C:\Dev\Kvartal\.agents\rules
mkdir C:\Dev\Kvartal\.agents\skills
mkdir C:\Dev\Kvartal\.vscode
```

## What Gets Created

After running the setup script, these directories will be created:

```
C:\Dev\Kvartal\
├── docs/
│   ├── design/
├── .agents/
│   ├── rules/
│   └── skills/
└── .vscode/
```

## Next Actions

After creating the directories:

1. AI Agent will create documentation files (*.md) in each folder
2. AI Agent will copy approved design reference  
3. AI Agent will create agent rules and skills
4. AI Agent will create VS Code configuration

## Status

- [x] AGENTS.md created in root
- [x] README.md created in root
- [x] setup-stage0.bat created in root
- [x] setup-stage0.ps1 created in root
- [ ] Directories created (run script above)
- [ ] Documentation files created
- [ ] Agent rules created
- [ ] Agent skills created
- [ ] VS Code config created
- [ ] Design reference copied

## Files to Be Created After Directory Setup

**docs/**
- ARCHITECTURE.md
- CURRENT_STATE.md
- ROADMAP.md
- AGENT_PROTOCOL.md
- TECH_STACK.md
- DATA_MODEL.md
- ACCEPTANCE_CRITERIA.md
- RESOURCE_INVENTORY.md

**docs/design/**
- APPROVED_DESIGN.md
- approved-index.html (copy of index.html)
- DESIGN_SYSTEM.md
- TAILWIND_MAPPING.md

**.agents/rules/**
- 00-core-rules.md
- 01-google-stack.md
- 02-security.md
- 03-product-context.md
- 04-reporting.md
- 05-code-style.md
- 06-approved-design.md

**.agents/skills/**
- planning.skill.md
- implementation.skill.md
- review.skill.md
- gcp.skill.md
- frontend-next.skill.md
- backend.skill.md
- ai.skill.md
- design-migration.skill.md

**.vscode/**
- settings.json
- extensions.json

Total: 31 documentation and configuration files

## Troubleshooting

**If batch script doesn't work:**
- Try running from Command Prompt (not PowerShell)
- Ensure you're in C:\Dev\Kvartal directory
- Check that C:\Dev exists

**If PowerShell script doesn't work:**
- Run: `powershell -ExecutionPolicy Bypass -File setup-stage0.ps1`
- If still blocked, run each mkdir command manually in Command Prompt

**If directories already exist:**
- That's fine! The scripts check before creating
- Proceed with AI Agent file creation

## Firebase Project Reference

These files will document the Firebase project status:

```
Project Name:       KVARTAL Dev
Project ID:         kvartal-dev
Project Number:     544286782827
App Hosting Backend: kvartal-web-dev
Region:             europe-west4
First Rollout:      FAILED (waiting for Next.js scaffold)
```

Do NOT modify Firebase until Stage 2 approval.

---

**Ready to create directories? Run the setup script above and confirm when done.**
