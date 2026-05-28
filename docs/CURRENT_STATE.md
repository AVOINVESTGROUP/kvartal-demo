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

## Stage 2: Migrate Design to Next.js Web MVP (Завершено)
- Проведен анализ `index.html`.
- Создана документация `DESIGN_SYSTEM.md` и `TAILWIND_MAPPING.md`.
- Настроен `globals.css` под Tailwind v4 с использованием дизайн-токенов.
- Реализованы компоненты: `Header`, `Hero`, `Features`, `Objects`, `Footer`.
- Собрана главная страница `apps/web/src/app/page.tsx` на основе утвержденного дизайна.
- Восстановлена витрина объектов `#objects` в Next.js: фильтр, счетчик, empty-state и 5 карточек из утвержденного `index.html`.
# Stage 3 Resume Note

- Created `docs/11-STAGE-3-SSOT-ADMIN-PLAN.md` as the pause/resume document.
- Current MVP direction: Cloud SQL/PostgreSQL as relational SSOT for offices, objects, leads, memberships, deal rooms, and audit.
- Backend direction: two dedicated Cloud Run services from the start, `platform-api` and `office-api`.
- Firebase Auth may remain the identity provider for `/admin` and `/platform`; roles and office memberships belong in PostgreSQL.
- Current public objects are still hardcoded in `apps/web/src/components/Objects.tsx`; Stage 3 moves them behind a backend API/repository layer.
- Before implementation: explicitly approve PostgreSQL, Prisma, Cloud Run service split, migration method for the current 5 objects, and rollout/provisioning permission.

## Stage 3 Scope Expansion Note (2026-05-28)

- Added `docs/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md`.
- Project direction expanded from a single-company brokerage site to a developer-owned multi-office platform.
- Initial offices/markets to support conceptually: Moscow, Tbilisi, Yerevan.
- Each connected office may have its own website, language, currency defaults, agents, and leads.
- Property objects belong to the contributing office; the contributor remains the information rights holder.
- Shared SSOT must support inter-office deal rooms: seller/owner-side office + buyer-side office.
- Platform Admin and Office Admin are separate administrative layers.
- Future architecture must prepare for multilingual content, multicurrency prices, subscriptions/monetization, and public investment market analytics.
- Stage 3 implementation plan must be revised before coding to include multi-office ownership fields and platform/office admin separation.

## Stage 3 Replan (2026-05-28)

- Replaced `docs/11-STAGE-3-SSOT-ADMIN-PLAN.md` with a multi-office Stage 3 plan.
- Updated `docs/02-DATA-MODEL.md` for offices, markets, object ownership, leads, co-broker requests, inter-office deal rooms, subscriptions, and analytics placeholders.
- Updated `docs/03-API-CONTRACTS.md` for public, platform-admin, office-admin, client-intent, co-broker, deal-room, and analytics contracts.
- Recommended first implementation slice: Stage 3A `Domain Types + Seed Data + Public Repository Layer`.
- Deployment remains Git-driven through Firebase App Hosting; no Firebase CLI deploy for App Hosting unless explicitly requested.

## Stage 3 Plan Hardening (2026-05-28)

- Rewrote `docs/11-STAGE-3-SSOT-ADMIN-PLAN.md` into approval-gated slices:
  - Stage 3A: Relational Architecture and Schema Draft.
  - Stage 3B: Cloud Run Backend Foundation.
  - Stage 3C: Public Objects API and Frontend Repository.
  - Stage 3D: Auth and Authorization Foundation.
  - Stage 3E: Office Object CRUD Through Backend.
  - Stage 3F: Seed Script, Cloud SQL Prep, and Controlled Bootstrap.
- Added `docs/adr/0001-postgresql-mvp-ssot.md` to record PostgreSQL as the proposed Stage 3 MVP SSOT decision.
- Added explicit guardrails for backend-only writes, audit logging, database indexes, Storage paths, PII exposure, mojibake recovery, and deal-room state conflict resolution.
- Immediate recommended next step is Stage 3A only; Firebase Auth, admin CRUD, Cloud Run deployment, Cloud SQL provisioning, migrations, and production seed require separate approval.

## Stage 3 Database Direction Change (2026-05-28)

- Replaced Firestore-first Stage 3 direction with backend-first relational SSOT.
- Removed `docs/adr/0001-firestore-mvp-ssot.md` and added `docs/adr/0001-postgresql-mvp-ssot.md`.
- Updated `docs/02-DATA-MODEL.md`, `docs/03-API-CONTRACTS.md`, and `docs/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md` to align with PostgreSQL/Cloud SQL as the Stage 3 SSOT.

## Stage 3 Backend Split Decision (2026-05-28)

- Confirmed that Stage 3 must not start with Next.js route handlers as the backend.
- Platform backend and office backend have different access models and must be separate Cloud Run services from the beginning.
- Planned services:
  - `apps/platform-api` for platform owner/operator control plane.
  - `apps/office-api` for office operations and local public workflows.
- Prisma is the preferred ORM/schema tool because it was already used successfully in another project.

## Stage 3 RBAC Direction (2026-05-28)

- User roles must be defined before schema/API implementation.
- Platform roles and office roles are separate:
  - platform roles: `platform_owner`, `platform_admin`, `platform_analyst`, `platform_viewer`;
  - organization roles: `organization_owner`, `organization_admin`;
  - office roles: `office_owner`, `office_admin`, `broker`, `office_analyst`, `office_viewer`.
- Platform roles are enforced by `platform-api`; organization and office roles are membership-scoped and enforced by `office-api`.
- Platform role does not automatically grant office membership, and office role does not grant platform access.
- Lead PII requires stricter permission checks than lead metadata.
- Platform emergency/moderation access must create audit logs.
- Users are employees/members of organizations that may operate in different countries with their own administrative structures.
- `activeOfficeId` must belong to `activeOrganizationId` for office-scoped requests.
- Added `docs/13-ROLE-SCHEMA-DRAFT.md` with a human-readable role model for approval:
  - platform operator: `Fixer.guru`;
  - connected organizations: `KVARTAL Moscow`, `Apart4u.co Tbilisi`, future partner firms;
  - public site users: property owners, buyers/investors, client contacts.
- Owner approved `platform_owner` as the maximum product role for the project owner/operator.
- `platform_owner` has global product authority; access to private organization data, lead PII, or emergency/moderation actions must be recorded in `audit_logs`.

## Stage 3 Property Model Direction (2026-05-28)

- Property database must start with `land`, `apartment`, and `house`, but must be expandable to industrial bases, factories, mixed-use assets, development sites, and investment projects.
- Core `property_objects` table should stay stable and hold common fields only.
- Specialized and maximum-detail characteristics should be modeled through related structures:
  - `property_object_components`;
  - `property_object_attributes`;
  - `property_object_economics`;
  - legal/utilities/development/operations extension tables as needed.
- Multi-component objects must be supported from the schema design stage.
- Object cards should support AI-assisted filling from unstructured data.
- AI extraction creates reviewable drafts and clarification questions; canonical SSOT writes require human confirmation and backend validation.
- AI intake should support open-source verification for актуальность and plausibility, storing source, checked date, result, and confidence.
- Open-source conflicts must require human review and do not replace legal due diligence.
- Added `docs/14-AI-PROPERTY-INTAKE.md` for the AI property intake flow.

## Stage 3A Implementation Start (2026-05-28)

- Created backend workspace scaffold:
  - `apps/platform-api`
  - `apps/office-api`
  - `packages/db`
  - `packages/domain`
  - `packages/auth`
- Added first Prisma schema draft at `packages/db/prisma/schema.prisma`.
- Prisma draft includes:
  - organizations and offices;
  - platform, organization, and office roles;
  - property objects, localizations, components, attributes, economics, media, and documents;
  - legal documents and legal document reviews for objects, leads, deal rooms, organizations, offices, and transactions;
  - AI property intake submissions, drafts, external checks, and extraction events;
  - client intents and private PII details;
  - co-broker requests;
  - deal rooms and deal room objects/events;
  - subscriptions, currency snapshots, market indicators/insights, and audit logs.
- TypeScript checks passed for:
  - `@kvartal/domain`
  - `@kvartal/auth`
  - `@kvartal/db`
  - `@kvartal/platform-api`
  - `@kvartal/office-api`
- Ran `pnpm install` to install/link Prisma and the new workspace packages.
- `pnpm --filter @kvartal/db prisma:validate` passes with a temporary local `DATABASE_URL`.
- TypeScript checks pass for all new Stage 3A packages/services:
  - `@kvartal/domain`
  - `@kvartal/auth`
  - `@kvartal/db`
  - `@kvartal/platform-api`
  - `@kvartal/office-api`

## Stage 3 Legal Documents Direction (2026-05-28)

- Added legal document layer to the data model and Prisma draft.
- Legal documents are separate from public property media/descriptions.
- Legal documents can be scoped to organization, office, property object, client intent, deal room, transaction, or other.
- Legal documents include confidentiality, review status, issue/expiry metadata, and review history.
- Private legal document access must be controlled by organization/office membership, deal-room participation, confidentiality, and audit rules.

## Stage 3A Cloud Provisioning (2026-05-28)

- Created Cloud SQL PostgreSQL instance in `kvartal-dev`:
  - instance: `kvartal-dev-postgres`
  - region/zone: `europe-west4-a`
  - database: `kvartal_app`
  - app user: `kvartal_app`
- Created Secret Manager secret:
  - `kvartal-database-url`
  - latest valid version: `2`
- Created runtime service accounts:
  - `kvartal-platform-api@kvartal-dev.iam.gserviceaccount.com`
  - `kvartal-office-api@kvartal-dev.iam.gserviceaccount.com`
  - `kvartal-migrations@kvartal-dev.iam.gserviceaccount.com`
- Created Artifact Registry Docker repository:
  - `europe-west4-docker.pkg.dev/kvartal-dev/kvartal`
- Built and pushed images:
  - `europe-west4-docker.pkg.dev/kvartal-dev/kvartal/db-migrate:stage3a`
  - `europe-west4-docker.pkg.dev/kvartal-dev/kvartal/platform-api:stage3a`
  - `europe-west4-docker.pkg.dev/kvartal-dev/kvartal/office-api:stage3a`
- Created and executed Cloud Run migration job:
  - job: `kvartal-db-migrate`
  - execution: `kvartal-db-migrate-d9mzz`
  - result: completed successfully
- Deployed Cloud Run services:
  - `kvartal-platform-api`
  - canonical URL: `https://kvartal-platform-api-qslxzoismq-ez.a.run.app`
  - `kvartal-office-api`
  - canonical URL: `https://kvartal-office-api-qslxzoismq-ez.a.run.app`
- Both services are `Ready=True` and container startup probes passed.
- Organization policy currently blocks `allUsers` Cloud Run invoker binding; services remain protected by IAM.
- Added `/readyz` endpoints that check live PostgreSQL connectivity:
  - `platform-api`: returns `organizationCount`
  - `office-api`: returns `officeCount`
- Latest successful revisions:
  - `kvartal-platform-api-00003-jkl`
  - `kvartal-office-api-00003-8nm`
- Readiness smoke tests passed:
  - `platform-api`: `{"ok":true,"service":"platform-api","database":"ready","organizationCount":3}`
  - `office-api`: `{"ok":true,"service":"office-api","database":"ready","officeCount":3}`
- Bootstrap seed is idempotent and currently creates:
  - markets: Moscow, Tbilisi, Dubai
  - organizations: `fixer-guru`, `kvartal-moscow`, `apart4u-tbilisi`
  - offices: platform operator, Moscow office, Tbilisi office

## Information Rights Boundary (2026-05-28)

- Data is private by default.
- The organization/office that enters an object, document, intake, or other operational record is the information rights holder.
- Other organizations must not receive access by default.
- Allowed access paths:
  - same owner organization/office membership;
  - explicitly published public showcase data;
  - explicit deal room or co-broker workflow;
  - `platform_owner` audited access.
- Public showcase exposure requires both:
  - `visibility = public`
  - `publicationStatus = published`
- Legal documents, private economics, lead PII, and confidential AI verification data are not public showcase data unless a separate explicit publication rule is later approved.
- Added code-level access helpers in `packages/auth/src/index.ts`:
  - `canAccessOwnedInformation`
  - `canExposeOnPublicShowcase`

## Google Data Management Layer (2026-05-28)

- Enabled data APIs in `kvartal-dev`:
  - BigQuery
  - BigQuery Data Policy
  - BigQuery Connection
  - Dataplex
  - Dataform
  - Datastream
  - Data Catalog
- Created BigQuery datasets in `europe-west4`:
  - `kvartal_raw`
  - `kvartal_curated`
  - `kvartal_governance`
- Created BigQuery Cloud SQL federated connection:
  - `kvartal-dev.europe-west4.kvartal_cloudsql`
  - verified by querying PostgreSQL `information_schema`; result: `37` public tables.
- Created Dataplex lake:
  - lake: `kvartal-governance`
  - zones: `raw`, `curated`
  - assets: `bq-raw`, `bq-curated`, `bq-governance`
- Created Data Catalog policy tag taxonomy:
  - taxonomy: `KVARTAL Sensitivity`
  - policy tags: `public`, `internal`, `confidential`, `legal_sensitive`, `personal_data`
- Added Dataform scaffold:
  - `infra/dataform/workflow_settings.yaml`
  - `infra/dataform/definitions/ssot_table_inventory.sqlx`
- Added `docs/15-GOOGLE-DATA-GOVERNANCE.md`.
