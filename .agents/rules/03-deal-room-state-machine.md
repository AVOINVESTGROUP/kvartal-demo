---
id: 03-deal-room-state-machine
type: rule
version: 1.1
status: active
last_updated: 2026-05-20
related: [docs/05-DEAL-ROOM-SPEC.md]
---

# Deal Room State Machine

- **Strict States:** `draft` → `sent` → `viewed` → `active` → `archived`.
- **Transitions:** Любая смена статуса должна быть вызвана событием (event-driven).
- **Audit:** Все события сохраняются в `DealRoomEvent` с меткой времени и автором.
- **TMA Sync:** Состояние в Telegram Mini App должно мгновенно отражать состояние бэкенда через WebSocket или лонг-поллинг.
