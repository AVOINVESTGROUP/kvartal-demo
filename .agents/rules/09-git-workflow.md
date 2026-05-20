---
id: 09-git-workflow
type: rule
version: 1.0
status: active
last_updated: 2026-05-20
related: [05-step-by-step-execution]
---

# Git Workflow

- **Branching:** `main` — стабильная ветка. Работа в feature-ветках приветствуется.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- **Scope:** Один коммит = одна логическая задача.
- **Sync:** Всегда делать `git pull` перед началом работы, чтобы избежать конфликтов.
- **Push:** После каждого завершенного Stage делать `git push`.
