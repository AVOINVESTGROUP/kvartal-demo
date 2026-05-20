# Текущее состояние проекта KVARTAL

## Общая информация
- Текущий корень проекта: `C:\Dev\Kvartal`

## Firebase
- Project name: `KVARTAL Dev`
- Project ID: `kvartal-dev`
- Project number: `544286782827`
- Parent org/folder: `fixer.guru`
- Plan: `Blaze`
- Apps: настроен

## Approved design
- Утверждённый дизайн: `C:\Dev\Kvartal\index.html`
- Примечание: `index.html` является утверждённым дизайном и не должен изменяться.

## Frontend
- Стек: `Next.js + React + TypeScript`

## Hosting
- Primary target: `Firebase App Hosting`

## Папки и инфраструктура
- В текущем репозитории созданы каркасные папки для следующих областей:
  - `.agents\rules`
  - `.agents\skills`
  - `.vscode`
  - `docs\design`
  - `docs\archived`
  - `infra\gcp`
  - `infra\firebase`
  - `scripts`
- Эти папки пока могут быть пустыми, так как проект находится на этапе подготовки структуры и документирования.

## Документация
- Основные документы проекта созданы и приведены в соответствие с аудитом:
  - `docs/01-ARCHITECTURE.md`
  - `docs/02-DATA-MODEL.md`
  - `docs/03-API-CONTRACTS.md`
  - `docs/04-MVP-SCOPE.md`
  - `docs/05-DEAL-ROOM-SPEC.md`
  - `docs/06-AI-SYSTEM.md`
  - `docs/07-PARTNER-LAYER.md`
  - `docs/08-COMPLIANCE-PLAN.md`
  - `docs/09-DEPLOYMENT.md`
  - `docs/10-DEVELOPER-SETUP.md`
  - `docs/AGENT_MISTAKES_LOG.md` (Реестр ошибок)

## Изменения по результатам аудита (20.05.2026)
- Устранено дублирование правил SSOT в `AGENTS.md`, `CLAUDE_COPILOT_OPERATING_SYSTEM.md` и `docs/00-OVERVIEW.md`.
- Все ключевые правила вынесены в `.agents/rules/` (00–12).
- Все навыки (`skills`) дополнены операционными деталями и привязаны к фазам MVP.
- Зафиксирована иерархия документов в `rule 11`.
- Устаревшие файлы структуры архивированы в `docs/archived/`.
- Все изменения синхронизированы с Git.

## Stage 1: Next.js Monorepo Scaffold (Завершено)
- Инициализирован `pnpm workspace` и `Turbo`.
- Создана структура `apps/web` и `packages/*`.
- Развернуто базовое приложение `Next.js 14+` с TypeScript и Tailwind в `apps/web`.
- Настроены базовые конфиги Firebase для `App Hosting`.
- Монорепозиторий готов к миграции дизайна.
