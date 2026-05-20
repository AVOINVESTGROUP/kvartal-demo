# DEVELOPER SETUP

## Цель
Подготовить рабочее окружение для разработки KVARTAL: инструменты, настройки и основные команды.

## 1. Необходимые инструменты

### Общие
- `Git`
- `VS Code`
- `Node.js` 20+ (LTS)
- `pnpm` 8+ или `npm`

### Google Cloud / Firebase
- `Firebase CLI`
- `Google Cloud SDK` (`gcloud`)
- `Google Chrome` / `Edge` для тестирования

### Дополнительные
- `Postman` или `Insomnia` для тестирования API
- `Telegram` для проверки TMA и ботов

## 2. Рекомендуемые расширения VS Code
- `ESLint`
- `Prettier`
- `TypeScript Hero` или стандартные TypeScript tools
- `Tailwind CSS IntelliSense`
- `Firebase`
- `GitLens`

## 3. Установка инструментов (Windows)

### Node.js
1. Скачать с `https://nodejs.org`
2. Установить версию 20+
3. Проверить:
```powershell
node -v
npm -v
```

### pnpm
```powershell
npm install -g pnpm
pnpm -v
```

### Firebase CLI
```powershell
npm install -g firebase-tools
firebase --version
```

### Google Cloud SDK
- Скачайте и установите с `https://cloud.google.com/sdk/docs/install`
- Инициализируйте:
```powershell
gcloud init
```

## 4. Базовая локальная настройка проекта

### Клонирование и установка зависимостей
```powershell
git clone https://github.com/AVOINVESTGROUP/kvartal-demo.git
cd kvartal
pnpm install
```

### Проверка окружения
```powershell
node -v
pnpm -v
firebase --version
gcloud version
```

### Firebase и Google Cloud
```powershell
firebase login
gcloud auth login
gcloud config set project kvartal-dev
```

### Локальный запуск (после scaffold / установки проекта)
```powershell
pnpm dev
```

## 5. Telegram подготовка

### Что нужно сделать
- Создать бот через `BotFather`
- Сохранить `Bot Token`
- Не хранить токен в репозитории
- Использовать `Secret Manager` или `.env.local`

### Библиотеки для Node.js
- `grammy`
- `telegraf`

## 6. Cloud / сервисы, которые стоит подготовить

### Рекомендуемые Google Cloud API
- Cloud Run
- Secret Manager
- Firestore
- Cloud Storage
- Cloud Build
- Cloud Logging
- IAM

### Firebase сервисы
- Firebase Hosting
- Firebase Auth
- App Check
- Firestore / Realtime Database (по решению)

## 7. Конфигурация секретов

- `GOOGLE_APPLICATION_CREDENTIALS` — если используется локальная служебная учётная запись
- `FIREBASE_TOKEN` — только для CI/CD
- `TELEGRAM_BOT_TOKEN` — хранить в Secret Manager
- `NEXT_PUBLIC_*` — публичные переменные только для безопасных значений

## 8. Что не нужно делать сейчас

- Не нужно разворачивать весь Google Cloud до готовности архитектуры
- Не нужно публиковать Telegram бота или TMA до этапа MVP
- Не нужно коммитить реальные секреты

## 9. Рекомендуемая последовательность
1. Подготовить локальное окружение и инструменты
2. Создать структуру проекта и документацию
3. Настроить Firebase CLI и Google Cloud SDK
4. На этапе Stage 1 подключить Firebase Hosting и Cloud Run
5. На этапе Stage 2 начать работу с Telegram и Gemini по необходимости
