---
id: 04-mvp-scope
type: specification
version: 1.1
status: active
last_updated: 2026-05-20
related: [docs/00-OVERVIEW.md, kvartal-architecture-design.skill]
---

# MVP SCOPE

## Цель
Определить границы минимально жизнеспособного продукта и исключения.

## Фаза 1: Web MVP
- Форма создания запросов для Москвы и Дубая
- AI-qualification через Gemini
- Базовый Deal Room с 3 объектами
- Просмотр объекта и статус сделки
- Аутентификация через Firebase
- Хостинг на Firebase App Hosting
- **Skills:** `kvartal-architecture-design`, `kvartal-ai-integration`, `kvartal-compliance-review`

## Фаза 2: SSOT + Админ
- Хранение данных в backend
- Админ-панель для объектов и deal room
- Ролевая модель: пользователь, брокер, админ
- Логи аудита и история событий
- **Skills:** `kvartal-data-modeling`

## Фаза 3: Deal Room + TMA
- Telegram Mini App для быстрого доступа
- Уведомления о статусе и новых комментариях
- Привязка партнёров и SLA в Дубае
- Состояния сделки и события
- **Skills:** `kvartal-deal-room-implementation`

## Фаза 4: AI MVP
- Интент классификация и confidence model
- Формирование брокерского резюме
- Фолбэк UX для низкого confidence
- Оценка качества AI и метрики
- **Skills:** `kvartal-ai-integration` (advanced)

## Фаза 5: Dubai Partner Layer
- Интеграция с партнерами, SLA, верификация
- **Skills:** `kvartal-partner-layer`

## Исключено из MVP
- Полный CRM внутри проекта
- Полноценный маркетплейс недвижимости
- Многоуровневая тарификация партнёров
- Публичный каталог и marketplace search

## Критерии успеха MVP
- Работающий поток «запрос → deal room → просмотр»
- Технически готовый backend и frontend
- Документированная архитектура и модель данных
- Валидация AI-интента и fallback
