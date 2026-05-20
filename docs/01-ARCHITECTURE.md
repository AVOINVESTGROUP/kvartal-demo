# ARCHITECTURE

## Цель
Описание архитектуры платформы KVARTAL: фронтенд, бэкенд, данные, интеграции и хостинг.

## Контекст
- Два рынка: Москва/Россия и Дубай/UAE
- Request-first модель, где клиентский запрос запускает процесс
- Deal Room как центральный рабочий объект
- Утверждённый дизайн: `index.html`

## Компоненты
- `Web Frontend` — Next.js + React + TypeScript
- `Backend API` — Node.js/Cloud Run
- `Authentication` — Firebase Auth + App Check
- `Data Storage` — Firestore или Cloud SQL
- `AI` — Vertex AI + Gemini API
- `Hosting` — Firebase App Hosting

## Система и потоки данных
1. Web-клиент отправляет задачу
2. Бэкенд вызывает AI для квалификации
3. Система выбирает подходящие объекты из SSOT
4. Создаётся Deal Room и отправляется пользователю
5. ТМА и CRM получают события и уведомления

## Интеграции
- Gemini API (интент-классификация, брокерские резюме)
- CRM webhook для передачи сделок
- Telegram Mini App для уведомлений и быстрого доступа
- Google Cloud Storage для медиа и документов

## Хостинг и окружения
- Primary production: Firebase App Hosting
- Backend: Cloud Run в europe-west4
- Dev/staging: отдельные проекты или среды внутри Firebase

## Решения и ограничения
- `index.html` — утверждённый дизайн, не изменяется
- Google Cloud + Firebase — основной техстек
- No Angular, только Next.js
- No direct CRM SSOT; данные живут в KVARTAL backend
