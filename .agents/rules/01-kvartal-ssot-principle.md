---
id: 01-kvartal-ssot-principle
type: rule
version: 1.1
status: active
last_updated: 2026-05-20
related: [docs/02-DATA-MODEL.md]
---

# KVARTAL SSOT Principle

- **Authority:** Backend KVARTAL является единственным источником истины для Property Objects, Deal Rooms и Client Intents.
- **CRM Role:** CRM (amoCRM/Bitrix24) — это вторичная система для управления воронкой продаж. Данные из CRM никогда не перетекают в KVARTAL без явной валидации API бэкенда.
- **Entities:** К SSOT относятся: `ClientIntent`, `PropertyObject`, `DealRoom`, `PartnerHandoff`, `InvestmentSnapshot`.
- **Versioning:** Любое изменение схемы данных должно сопровождаться ADR и обновлением `docs/02-DATA-MODEL.md`.
