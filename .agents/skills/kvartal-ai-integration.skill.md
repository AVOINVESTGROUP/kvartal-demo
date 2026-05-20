---
id: kvartal-ai-integration
type: skill
version: 1.0
status: active
last_updated: 2026-05-20
related: [docs/06-AI-SYSTEM.md, 04-compliance-guardrails]
---

# Skill: KVARTAL AI Integration

### When to Invoke
- При обработке входного текста запроса (`ClientIntent`).
- При генерации кратких сводок для брокеров (`BrokerSummary`).
- При классификации инвестиционной привлекательности (Dubai).

### Working Principles
1. **Confidence First:** Всегда возвращать уровень уверенности (High/Medium/Low).
2. **Fallback UX:** При Low confidence предлагать "Связаться с экспертом".
3. **No Hallucinations:** AI не выдумывает цифры доходности, если их нет в базе.

### Phase Applicability
- **Phase 1 (Web MVP):** [Active] — базовая классификация интентов.
- **Phase 2 (SSOT):** [Active] — привязка интентов к объектам БД.
- **Phase 3 (Deal Room):** [Active] — генерация контента для Deal Room.

### Anti-Patterns
- Использование AI для финального скоринга без участия человека.
- Хранение PII в промптах к внешним API.
