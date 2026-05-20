# DEAL ROOM SPEC

## Цель
Задокументировать Deal Room как центральную рабочую сущность KVARTAL.

## Описание
Deal Room — персональный рабочий канал, где хранится результат запроса клиента, подборка объектов, комментарии и статус сделки.

## Состояния
- `draft` — подготовлено брокером
- `sent` — отправлено пользователю
- `viewed` — пользователь открыл
- `active` — пользователь взаимодействует
- `archived` — завершено или отклонено

## События
- `dealroom_created`
- `shortlist_updated`
- `object_viewed`
- `comment_added`
- `status_changed`
- `partner_assigned`

## Структура
### DealRoom
- id
- intent_id
- owner_id
- status
- market
- secret_link
- created_at
- updated_at
- metadata

### DealRoomEvent
- id
- dealroom_id
- event_type
- payload
- author_id
- created_at

## Цепочка действий
1. Создание Deal Room
2. Квалификация AI и подбор объектов
3. Отправка пользователю
4. Обновление статуса при просмотре и взаимодействии
5. Добавление комментариев и партнёров

## UX требования
- Быстрый доступ к информации о рынке
- Прозрачная логика статусов
- Возможность открыть Deal Room как в Web, так и в TMA
- Безопасный секретный доступ по ссылке

## API для Deal Room
- `POST /api/v1/deal-rooms`
- `GET /api/v1/deal-rooms/{id}`
- `PATCH /api/v1/deal-rooms/{id}`
- `POST /api/v1/deal-rooms/{id}/events`
- `GET /api/v1/deal-rooms/{id}/events`

## Требования к данным
- Все изменения логируются
- Статусы изменяются только по допустимой траектории
- Одному Deal Room может принадлежать несколько объектов
- Поддержка рынка `moscow` и `dubai`
