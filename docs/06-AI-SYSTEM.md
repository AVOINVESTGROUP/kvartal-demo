# AI SYSTEM

## Цель
Определить архитектуру AI-процесса для KVARTAL: интенты, confidence model, резюме и guardrails.

## Роль AI
- Классифицировать задачи клиента
- Оценивать уверенность (`high`, `medium`, `low`)
- Предлагать подходящие объекты
- Формировать брокерское резюме

## Компоненты
- `Gemini API` — основной модуль для NLP и генерации текстов
- `Backend qualification service` — логика выбора объектов
- `Confidence evaluator` — границы доверия и fallback
- `Audit log` — запись запросов и ответов AI

## Поток данных
1. Пользователь отправляет задачу
2. Backend вызывает Gemini
3. Gemini возвращает intent, тему, параметры
4. Backend строит shortlist и уровень confidence
5. Если `low`, показывается fallback UX

## Guardrails
- AI не принимает окончательных решений без проверки брокером
- Не использовать AI для юридических выводов
- При `low` confidence: предлагать брокерскую помощь
- Для Dubai-инвестиций проверять документы партнёра

## Метрики качества
- `intent_accuracy`
- `confidence_precision`
- `broker_override_rate`
- `user_engagement`

## Ключевые API
- `POST /api/v1/ai/qualify`
- `POST /api/v1/ai/feedback`

## Примечания
- Интеграция Gemini документируется в `docs/06-AI-SYSTEM.md`
- Файл Gemini не является обязательным артефактом; важно описание интеграции
