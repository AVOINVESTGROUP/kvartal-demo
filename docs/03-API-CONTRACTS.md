# API CONTRACTS

## Цель
Описание API-контрактов для взаимодействия фронтенда, бэкенда, TMA и внешних систем.

## Общая архитектура API
- Версия: `v1`
- Формат: REST + JSON
- Аутентификация: Firebase Auth JWT
- Авторизация: роль пользователя и контекст Deal Room

## Структура запросов
- `POST /api/v1/ai/qualify`
- `POST /api/v1/deal-rooms`
- `GET /api/v1/deal-rooms/{id}`
- `PATCH /api/v1/deal-rooms/{id}`
- `POST /api/v1/deal-rooms/{id}/events`
- `GET /api/v1/objects`
- `GET /api/v1/objects/{id}`

## Примеры
### POST /api/v1/ai/qualify
Request:
```json
{
  "task_text": "Ищу офис 200м² рядом с метро",
  "market": "moscow",
  "budget_range": {"min": 2000000, "max": 3000000}
}
```
Response:
```json
{
  "intent_id": "xxx",
  "confidence": "high",
  "shortlist": [
    {"object_id": "o1", "match_score": 0.92, "reason": "район, площадь, бюджет"}
  ]
}
```

## Ошибки
- `400` — некорректные данные
- `401` — неавторизован
- `403` — доступ запрещён
- `404` — не найдено
- `422` — низкая уверенность AI / неподдерживаемый запрос
- `500` — внутренняя ошибка

## Вебхуки
- CRM webhook: `POST /internal/webhooks/crm`
- Формат: `{ dealroom_id, status, objects, broker_id, timestamp }`
- Отправка: после ключевых событий Deal Room

## Требования к контрактам
- Валидация на уровне схем (Zod / OpenAPI)
- Версионирование endpoint-ов
- Ясные ответы и consistent error format

## Международные особенности
- Поле `market` обязательно
- В условиях рынка `dubai` допускаются валютные поля `AED` и `USD`
- Для `moscow` используются `RUB`
