# DATA MODEL

## Цель
Фиксация ключевых сущностей, связей и требований к данным для KVARTAL.

## Основные сущности
- `ClientIntent`
- `PropertyObject`
- `DealRoom`
- `DealRoomEvent`
- `Partner`
- `User`
- `Broker`

## Отношения
- `ClientIntent` → `DealRoom` (1:N)
- `DealRoom` → `PropertyObject` (M:N)
- `DealRoom` → `DealRoomEvent` (1:N)
- `Partner` → `DealRoom` (1:N)
- `User` / `Broker` → `DealRoom` (1:N)

## Требования
- SSOT: данные объектов и сделок хранятся в backend
- Аудит: хранить время, автора, статус и изменения
- Многорынковость: поле `market` для Москвы и Дубая
- Безопасность: доступ только по роли и контексту

## Решение по хранилищу
- `Firestore` или `Cloud SQL` в зависимости от требований к запросам
- Индексы для фильтрации по рынку, бюджету, классу активов
- Миграции: версионирование схем данных

## Примеры схем
### ClientIntent
- id
- user_id
- market
- budget_range
- requirement_text
- confidence_level
- created_at
- updated_at

### DealRoom
- id
- intent_id
- status
- owner_id
- secret_link
- market
- created_at
- updated_at

### PropertyObject
- id
- market
- location
- price
- size
- asset_type
- developer_or_owner
- yield_estimate
- documents

## Документирование изменений
- ADR для любых серьёзных изменений модели данных
- `docs/02-DATA-MODEL.md` является основным референсом
