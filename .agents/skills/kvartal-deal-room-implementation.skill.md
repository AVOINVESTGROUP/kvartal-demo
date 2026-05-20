---
id: kvartal-deal-room-implementation
type: skill
version: 1.0
status: active
last_updated: 2026-05-20
related: [docs/05-DEAL-ROOM-SPEC.md, 03-deal-room-state-machine]
---

# Skill: KVARTAL Deal Room Implementation

### When to Invoke
- При создании логики управления состоянием (State Management).
- При реализации интерфейса Deal Room в Next.js или TMA.
- При настройке уведомлений о событиях сделки.

### Principles
1. **Event-Driven:** Изменение UI только на основе событий бэкенда.
2. **Mobile First:** TMA — основной канал взаимодействия.
3. **Deep Linking:** Каждая комната имеет уникальную безопасную ссылку.

### Phase Applicability
- **Phase 1:** [Dormant] — только концепт.
- **Phase 3:** [Critical] — полная реализация.

### Success Metrics
- Скорость открытия комнаты в TMA < 2с.
- 100% логирование событий (просмотрено, кликнуто).
