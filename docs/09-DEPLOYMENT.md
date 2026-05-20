# DEPLOYMENT

## Цель
Описание стратегии развёртывания, окружений и мониторинга.

## Окружения
- `local`
- `staging`
- `production`

## Хостинг
- Frontend: Firebase App Hosting
- Backend: Cloud Run

## CI/CD
- Пуш в репозиторий → тесты → deploy
- Pipeline должен проверять lint, build, unit tests
- Развёртывание в staging перед production

## Секреты
- Использовать Google Secret Manager
- Не хранить секреты в коде
- Переменные окружения для сервисов и API

## Мониторинг
- Cloud Logging
- Cloud Monitoring / Alerts
- Ошибки и latency

## Резервное копирование
- База данных: регулярные резервные копии
- Медиа: проверка доступности storage

## Rollback
- Быстрый откат версии frontend в Firebase
- Контроль версий backend image
- План на случай отказа
