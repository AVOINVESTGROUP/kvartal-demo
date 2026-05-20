---
id: 06-security-and-secrets
type: rule
version: 1.0
status: active
last_updated: 2026-05-20
related: [00-claude-core-mandate]
---

# Security & Secrets

- **Zero Tolerance:** Никогда не коммитить `.env`, секреты или ключи.
- **Validation:** Перед каждым Git Commit проверять список измененных файлов на наличие секретов.
- **App Check:** Все запросы к Firebase должны проходить через Firebase App Check для защиты от фрода.
- **Access Control:** Использовать Firebase Security Rules (для Firestore/Storage) и проверку ролей в Cloud Run.
