---
id: 02-two-market-architecture
type: rule
version: 1.1
status: active
last_updated: 2026-05-20
related: [docs/00-OVERVIEW.md]
---

# Two-Market Architecture

- **Isolation:** Код и данные должны четко разделять `Moscow` (Commercial) и `Dubai` (Investment).
- **Context-Aware:** Интерфейсы и логика должны проверять флаг `market`.
- **Request-First:** В обоих рынках входная точка — запрос клиента, а не каталог.
- **Specifics:**
  - Moscow: упор на локации (ЦАО), особняки, офф-маркет.
  - Dubai: упор на доходность (yield), DLD-валидацию, офф-план.
