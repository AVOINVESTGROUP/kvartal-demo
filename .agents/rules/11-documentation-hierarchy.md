---
id: 11-documentation-hierarchy
type: rule
version: 1.0
status: active
last_updated: 2026-05-20
---

# Documentation Hierarchy

При возникновении противоречий между документами приоритет определяется следующим образом (от высшего к низшему):

1. **.agents/rules/*.md** (Жесткие правила выполнения)
2. **docs/CURRENT_STATE.md** (Фактическая ситуация на текущий момент)
3. **docs/*.md** (Архитектурные и продуктовые спецификации)
4. **.agents/skills/*.md** (Рекомендации по реализации)
5. **README.md / AGENTS.md** (Общие обзоры)
6. **docs/archived/* (Игнорируется как источник истины)**
