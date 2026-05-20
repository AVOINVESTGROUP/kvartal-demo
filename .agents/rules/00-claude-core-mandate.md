---
id: 00-claude-core-mandate
type: rule
version: 1.1
status: active
last_updated: 2026-05-20
related: [docs/01-ARCHITECTURE.md, 10-approved-design-preservation]
---

# Core Mandate

- **Plan-First:** Любая реализация начинается с плана, утвержденного пользователем.
- **Approval:** "Согласование" означает явное "Да", "Делай" или аналогичное подтверждение от пользователя в чате.
- **Design Preservation:** `index.html` в корне — это святыня. Не изменять, не удалять, не переименовывать.
- **No Secrets:** Запрещено хардкодить API ключи, пароли или токены. Использовать Secret Manager или `.env.local` (в игноре).
- **Conciseness:** Ответы должны быть технически точными и краткими.
