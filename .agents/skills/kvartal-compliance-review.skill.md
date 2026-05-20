---
id: kvartal-compliance-review
type: skill
version: 1.0
status: active
last_updated: 2026-05-20
related: [docs/08-COMPLIANCE-PLAN.md, 04-compliance-guardrails]
---

# Skill: KVARTAL Compliance Review

### When to Invoke
- Перед запуском любой формы сбора данных.
- При настройке интеграций с внешними партнерами (Dubai).
- При реализации функций экспорта/удаления данных.

### Deliverables
- **Compliance Checklist:** Таблица соответствия 152-ФЗ и Dubai Data Law.
- **Privacy Notice:** Обновление текста согласий.

### Phase Applicability
- **Phase 1:** [Active] — согласия на сайте.
- **Phase 4:** [Critical] — при интеграции AI и передаче данных партнерам.

### Anti-Patterns
- Передача данных в Дубай без явного согласия пользователя в интерфейсе.
- Отсутствие логов удаления данных.
