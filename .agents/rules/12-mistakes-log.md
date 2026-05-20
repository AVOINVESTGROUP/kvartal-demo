---
id: 12-mistakes-log
type: rule
version: 1.0
status: active
last_updated: 2026-05-20
related: [docs/AGENT_MISTAKES_LOG.md]
---

# Mistakes Log Rule

- **Check:** Перед началом любой задачи (Stage) агент обязан прочитать `docs/AGENT_MISTAKES_LOG.md`.
- **Record:** При совершении ошибки (технической, архитектурной или процедурной), которая была исправлена, агент должен внести ее в лог.
- **Format:** Дата, Описание ошибки, Причина, Как избежать в будущем.
- **Goal:** Исключить повторение одних и тех же ошибок в рамках сессии и проекта.
