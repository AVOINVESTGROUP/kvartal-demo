---
id: kvartal-data-modeling
type: skill
version: 1.0
status: active
last_updated: 2026-05-20
related: [docs/02-DATA-MODEL.md, 01-kvartal-ssot-principle]
---

# Skill: KVARTAL Data Modeling

### When to Invoke
- При добавлении новых полей в сущности `PropertyObject`, `DealRoom`.
- При проектировании связей между рынками.
- При выборе между SQL (Cloud SQL) и NoSQL (Firestore).

### Principles
1. **SSOT Enforcement:** Каждое поле должно иметь владельца (Backend).
2. **Audit Trails:** Каждая сущность имеет `created_by`, `updated_at`.
3. **Market Partitioning:** Явное разделение данных `market: moscow | dubai`.

### Deliverables
- **Entity Diagram:** Описание связей.
- **Migration Script:** Код для обновления схемы.

### Phase Applicability
- **Phase 1:** [Active] — базовая схема Intent.
- **Phase 2:** [Critical] — полная реализация SSOT.
