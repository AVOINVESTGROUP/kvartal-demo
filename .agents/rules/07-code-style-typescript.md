---
id: 07-code-style-typescript
type: rule
version: 1.0
status: active
last_updated: 2026-05-20
---

# Code Style & TypeScript

- **Standard:** TypeScript 5+, Strict Mode = true.
- **Naming:** CamelCase для переменных/функций, PascalCase для компонентов/типов.
- **Imports:** Группировка (external → internal → styles/assets). Абсолютные пути через `@/`.
- **Components:** Functional components, React Server Components (RSC) по умолчанию, Client Components только при необходимости (`'use client'`).
- **Styles:** Tailwind CSS, использование токенов из `docs/design/DESIGN_SYSTEM.md`.
