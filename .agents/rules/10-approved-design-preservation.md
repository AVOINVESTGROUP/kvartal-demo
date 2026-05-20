---
id: 10-approved-design-preservation
type: rule
version: 1.0
status: active
last_updated: 2026-05-20
related: [00-claude-core-mandate]
---

# Approved Design Preservation

- **Index.html:** Файл `index.html` в корне проекта — это утвержденный дизайн.
- **Reference:** Копия для справки лежит в `docs/design/approved-index.html`.
- **Constraint:** Запрещено вносить изменения в эти файлы. Они используются только для чтения (CSS-классы, структура, цвета).
- **Migration:** При переносе в Next.js (Tailwind) — строго следовать маппингу из `docs/design/TAILWIND_MAPPING.md`.
