# 05-step-by-step-execution

- Планируй задачу перед выполнением.
- Утверждай план с заказчиком или старшими инженерами.
---
id: 05-step-by-step-execution
type: rule
version: 1.2
status: active
last_updated: 2026-05-20
related: [09-git-workflow, docs/CURRENT_STATE.md]
---

# Step-by-Step Execution

- **Cycle:** Plan → Approval → Execution → Verification → Report.
- **Reporting:** После каждого шага обновлять `docs/CURRENT_STATE.md`.
- **Git Commit:** Каждый завершенный под-этап или логический блок должен фиксироваться в Git.
- **Factual Rigor:** При обнаружении ошибки в документации — сначала исправь документ, потом продолжай код.
