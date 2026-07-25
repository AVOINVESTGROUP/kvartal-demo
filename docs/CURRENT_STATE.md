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
  - `docs/00-MASTER-ARCHITECTURE.md`
  - `docs/02-DATA-MODEL.md`
  - `docs/03-API-CONTRACTS.md`
  - `docs/05-DEAL-ROOM-SPEC.md`
  - `docs/06-AI-SYSTEM.md`
  - `docs/10-DEVELOPER-SETUP.md`
  - `docs/13-ROLE-SCHEMA-DRAFT.md`
  - `docs/14-AI-PROPERTY-INTAKE.md`
  - `docs/15-GOOGLE-DATA-GOVERNANCE.md`
  - `docs/16-PARTNER-NETWORK-PLATFORM.md`
  - `docs/17-PARTNER-NETWORK-IMPLEMENTATION-PLAN.md`
  - `docs/18-GOOGLE-ACCOUNT-AUTH.md`
  - `docs/AGENT_MISTAKES_LOG.md` (Реестр ошибок)

## Изменения по результатам аудита (20.05.2026)
- Устранено дублирование правил SSOT в `AGENTS.md`, `CLAUDE_COPILOT_OPERATING_SYSTEM.md` и `docs/archived/superseded/00-OVERVIEW.md`.
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

- Created `docs/archived/superseded/11-STAGE-3-SSOT-ADMIN-PLAN.md` as the pause/resume document.
- Current MVP direction: Cloud SQL/PostgreSQL as relational SSOT for offices, objects, leads, memberships, deal rooms, and audit.
- Backend direction: two dedicated Cloud Run services from the start, `platform-api` and `office-api`.
- Firebase Auth may remain the identity provider for `/admin` and `/platform`; roles and office memberships belong in PostgreSQL.
- Current public objects are still hardcoded in `apps/web/src/components/Objects.tsx`; Stage 3 moves them behind a backend API/repository layer.
- Before implementation: explicitly approve PostgreSQL, Prisma, Cloud Run service split, migration method for the current 5 objects, and rollout/provisioning permission.

## Stage 3 Scope Expansion Note (2026-05-28)

- Added `docs/archived/superseded/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md`.
- Project direction expanded from a single-company brokerage site to a developer-owned multi-office platform.
- Initial offices/markets to support conceptually: Moscow, Tbilisi, Yerevan.
- Each connected office may have its own website, language, currency defaults, agents, and leads.
- Property objects belong to the contributing office; the contributor remains the information rights holder.
- Shared SSOT must support inter-office deal rooms: seller/owner-side office + buyer-side office.
- Platform Admin and Office Admin are separate administrative layers.
- Future architecture must prepare for multilingual content, multicurrency prices, subscriptions/monetization, and public investment market analytics.
- Stage 3 implementation plan must be revised before coding to include multi-office ownership fields and platform/office admin separation.

## Stage 3 Replan (2026-05-28)

- Replaced `docs/archived/superseded/11-STAGE-3-SSOT-ADMIN-PLAN.md` with a multi-office Stage 3 plan.
- Updated `docs/02-DATA-MODEL.md` for offices, markets, object ownership, leads, co-broker requests, inter-office deal rooms, subscriptions, and analytics placeholders.
- Updated `docs/03-API-CONTRACTS.md` for public, platform-admin, office-admin, client-intent, co-broker, deal-room, and analytics contracts.
- Recommended first implementation slice: Stage 3A `Domain Types + Seed Data + Public Repository Layer`.
- Deployment remains Git-driven through Firebase App Hosting; no Firebase CLI deploy for App Hosting unless explicitly requested.

## Stage 3 Plan Hardening (2026-05-28)

- Rewrote `docs/archived/superseded/11-STAGE-3-SSOT-ADMIN-PLAN.md` into approval-gated slices:
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
- Updated `docs/02-DATA-MODEL.md`, `docs/03-API-CONTRACTS.md`, and `docs/archived/superseded/12-MULTI-OFFICE-PLATFORM-ARCHITECTURE.md` to align with PostgreSQL/Cloud SQL as the Stage 3 SSOT.

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

## Partner Network Product Correction (2026-05-28)

- Clarified product model:
  - `Fixer.guru` is the platform owner/operator, not just another brokerage organization.
  - connected real estate companies are partner organizations.
  - offices are branches/city units inside partner organizations.
  - partner sites show branded public vitrines backed by the shared Fixer.guru platform inventory.
- Added `docs/16-PARTNER-NETWORK-PLATFORM.md`.
- Added `docs/17-PARTNER-NETWORK-IMPLEMENTATION-PLAN.md`.
- Corrected target app terminology:
  - `apps/platform-admin` for Fixer.guru owner console;
  - `apps/partner-admin` for partner organization admin;
  - `apps/partner-site` for branded partner public websites;
  - `apps/platform-api` for platform owner backend;
  - `apps/partner-api` for authenticated partner operations;
  - `apps/public-api` for public-safe inventory and lead intake.
- Approved shared inventory term:
  - English: `Shared Public Inventory`
  - Russian: `Общий опубликованный пул объектов`
  - meaning: a common pool of objects approved for display that can be rendered on different partner websites in each partner's own design.
- Current `/admin/*` pages inside `apps/web` are considered a temporary misplaced prototype and must be removed or moved before the next approved implementation slice.

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

## Partner Site Tenant Structure (2026-05-28)

- `apps/partner-site` now has explicit tenant directories for:
  - `apart4u` as the active Tbilisi partner site;
  - `dubai` as a future Dubai partner site;
  - `yerevan` as a future Yerevan partner site.
- Tenant configs live in `apps/partner-site/src/tenants/*/config.ts`.
- Public tenant routes:
  - `/` renders the default `apart4u` site;
  - `/apart4u` renders the Apart4u tenant;
  - `/dubai` renders the Dubai tenant;
  - `/yerevan` renders the Yerevan tenant.
- Future partner media directories were reserved:
  - `apps/partner-site/public/dubai`
  - `apps/partner-site/public/yerevan`
- The shared public inventory is rendered through a reusable partner-site component while preserving separate partner brand/config ownership.

## App Hosting Split Preparation (2026-05-28)

- Prepared separate Firebase App Hosting config entries for:
  - `kvartal-web-dev` -> `apps/web`;
  - `fixer-platform-admin-dev` -> `apps/platform-admin`;
  - `partner-admin-dev` -> `apps/partner-admin`;
  - `partner-site-dev` -> `apps/partner-site`.
- Added API environment bindings:
  - `platform-admin` -> `kvartal-platform-api`;
  - `partner-admin` -> `kvartal-office-api` as current partner API backend;
  - `partner-site` -> `kvartal-office-api` as current public-safe API backend.
- Frontend apps do not receive direct `DATABASE_URL`; Cloud SQL/PostgreSQL remains reachable only through Cloud Run API services.

## App Hosting Split Deployment (2026-05-28)

- Created Firebase App Hosting backends in `kvartal-dev` / `europe-west4`:
  - `fixer-platform-admin-dev`
    - root: `apps/platform-admin`
    - URL: `https://fixer-platform-admin-dev--kvartal-dev.europe-west4.hosted.app`
  - `partner-admin-dev`
    - root: `apps/partner-admin`
    - URL: `https://partner-admin-dev--kvartal-dev.europe-west4.hosted.app`
  - `partner-site-dev`
    - root: `apps/partner-site`
    - URL: `https://partner-site-dev--kvartal-dev.europe-west4.hosted.app`
- Initial App Hosting builds completed successfully:
  - `fixer-platform-admin-dev`: `build-2026-05-28-001`
  - `partner-admin-dev`: `build-2026-05-28-001`
  - `partner-site-dev`: `build-2026-05-28-001`
- Initial App Hosting rollouts completed successfully:
  - `fixer-platform-admin-dev`: `rollout-2026-05-28-001`
  - `partner-admin-dev`: `rollout-2026-05-28-001`
  - `partner-site-dev`: `rollout-2026-05-28-001`
- Verified public responses:
  - platform admin URL: `200`
  - partner admin URL: `200`
  - partner site `/apart4u`: `200`
  - partner site `/dubai`: `200`
  - partner site `/yerevan`: `200`
- Granted `roles/run.invoker` on protected Cloud Run APIs to:
  - `firebase-app-hosting-compute@kvartal-dev.iam.gserviceaccount.com`
- Verified database-backed API readiness:
  - `platform-api /readyz`: `database=ready`, `organizationCount=3`
  - `office-api /readyz`: `database=ready`, `officeCount=3`

## Database-Backed Admin and Partner Site Wiring (2026-05-29)

- Added platform API read endpoints:
  - `GET /api/v1/platform/organizations`
  - `GET /api/v1/platform/summary`
- Added partner/public API read endpoints:
  - `GET /api/v1/admin/context`
  - `GET /api/v1/public/objects`
- Added runtime server-side API fetch helpers for:
  - `apps/platform-admin`
  - `apps/partner-admin`
  - `apps/partner-site`
- Frontend pages now fetch database-backed data through protected Cloud Run APIs using App Hosting service-account identity tokens.
- Seed data expanded to include:
  - `dubai-partner`
  - `yerevan-partner`
  - `yerevan-real-estate` market
  - initial published shared-public objects for Moscow, Tbilisi, Dubai, and Yerevan.

## KVARTAL Site and Admin Wiring (2026-05-29)

- Added `apps/kvartal-admin` as a dedicated App Hosting app for the `kvartal-moscow` partner organization.
- Prepared `kvartal-admin-dev` App Hosting config entry.
- Updated `apps/web` so the KVARTAL public site reads shared public inventory from the protected public API at runtime.
- The KVARTAL public vitrina now supports country/city/type filtering for multi-city and multi-country inventory.
- Added the real KVARTAL site objects from the current web vitrina into the database seed:
  - Bataysk warehouse/industrial complex;
  - Sirius hotel development site, Figurnaya 45;
  - Domodedovo land plot;
  - Kubinka land plot;
  - Istra/Holshcheviki land plot.
- Added separate market rows for Bataysk, Sirius, Domodedovo, Kubinka, and Istra so the public vitrina can filter them correctly by city.

## Documentation Master Architecture Cleanup (2026-05-29)

- Added `docs/00-MASTER-ARCHITECTURE.md` as the current source of truth for the full Fixer.guru / KVARTAL platform architecture.
- Moved superseded documents into `docs/archived/superseded/` instead of deleting them.
- Added `docs/archived/superseded/README.md` with archive reasons and an encoding verification rule.
- Updated active document references to use the master architecture, current partner-network architecture, and implementation plan.
- Added a documentation process rule: do not claim a file has broken encoding based only on terminal output; verify the file itself first.

## Multi-Tenant Partner Admin Clarification (2026-05-31)

- Confirmed the target architecture: one shared `apps/partner-admin` for all partner organizations, not separate duplicated admin applications.
- `apps/kvartal-admin` remains a working KVARTAL baseline/migration implementation, but it must not become the long-term pattern for every organization.
- Partner admin tenant context must be resolved through Firebase Google Auth plus PostgreSQL users, memberships, roles, organization context, office context, and object-level permissions.
- Property card public text is stored as localization data (`PropertyObjectLocalization`) with required `ru/en` and organization-specific third language support.
- Website-level hiding of individual partner objects is stored as `SiteObjectVisibilityOverride`; it does not unpublish the canonical object globally.
- Updated `docs/00-MASTER-ARCHITECTURE.md`, `docs/02-DATA-MODEL.md`, and `docs/03-API-CONTRACTS.md` to make this the implementation direction.

## Partner Admin App Hosting Rollout From Git (2026-05-31)

- Verified the working tree was clean before deployment checks.
- Verified latest Git commit on `main`: `a64ac3a7ad679f8b35a3aa10e171b0b87b362d98`.
- Ran the Firebase-equivalent monorepo build gate before rollout:
  - `pnpm exec turbo build --force`
  - result: `10 successful, 10 total`.
- Created Firebase App Hosting build for `partner-admin-dev` from Git branch `main`:
  - build: `build-2026-05-31-001`
  - source commit: `a64ac3a7ad679f8b35a3aa10e171b0b87b362d98`
  - state: `READY`
- Created Firebase App Hosting rollout for `partner-admin-dev`:
  - rollout: `rollout-2026-05-31-001`
  - state: `SUCCEEDED`
- Verified live URLs:
  - `https://partner-admin-dev--kvartal-dev.europe-west4.hosted.app/login` -> `200`
  - login HTML contains `FIXER.GURU PARTNER ADMIN`, `Вход в админку организации`, and `Войти через Google`
  - unauthenticated `/` redirects with `307`
  - `https://kvartal-web-dev--kvartal-dev.europe-west4.hosted.app` -> `200`
- Important lesson: `partner-admin-dev` did not automatically roll out the May 31 Git commit. Future agents must verify the target App Hosting backend rollout, not only the Git push or another backend's build status.

## Firebase Auth Authorized Domain Fix (2026-05-31)

- Symptom on `partner-admin-dev` login page:
  - `Firebase: Error (auth/unauthorized-domain).`
- Root cause:
  - `partner-admin-dev--kvartal-dev.europe-west4.hosted.app` was missing from Firebase Authentication Authorized domains.
- Fixed in Firebase Auth config for project `kvartal-dev` through Identity Toolkit admin API:
  - added `partner-admin-dev--kvartal-dev.europe-west4.hosted.app`
  - preserved existing authorized domains:
    - `localhost`
    - `kvartal-dev.firebaseapp.com`
    - `kvartal-dev.web.app`
    - `fixer-platform-admin-dev--kvartal-dev.europe-west4.hosted.app`
    - `kvartal-admin-dev--kvartal-dev.europe-west4.hosted.app`
- Verified by reading Firebase Auth config back from `identitytoolkit.googleapis.com`.
- Verified `https://partner-admin-dev--kvartal-dev.europe-west4.hosted.app/login` returns `200`.

## Partner Admin Tenant Resolution Fix (2026-05-31)

- Verified live platform access for `abtiurin@gmail.com`:
  - organization membership: `kvartal-moscow`
  - role: `organization_owner`
  - no platform role required for partner admin access.
- Root cause of wrong tenant behavior:
  - `apps/partner-admin` used `PARTNER_ORGANIZATION_SLUG=apart4u-tbilisi` as the active tenant even after Google login.
  - the main admin page loaded data from the env tenant instead of the authenticated user's session tenant.
  - server actions trusted hidden form `organizationSlug` values instead of enforcing the session organization.
- Fixed in `apps/partner-admin`:
  - login session now resolves organization from PostgreSQL membership returned by `platform-api`;
  - if a user has one organization membership, that organization is used;
  - if a user has several memberships, the configured env organization is only a temporary preference until an organization switcher exists;
  - page data loads from `session.organizationSlug`;
  - create/update/publish/member/visibility actions use `session.organizationSlug`, not form-provided organization scope.
- Verified build before rollout:
  - `pnpm exec turbo build --force`
  - result: `10 successful, 10 total`.
- Committed and pushed:
  - `c58aeb6 fix: resolve partner admin tenant from user membership`
- Rolled out `partner-admin-dev` from Git:
  - build: `build-2026-05-31-002`
  - source commit: `c58aeb6bebfd4249081a3ffae1e36312f736f82d`
  - rollout: `rollout-2026-05-31-002`
  - rollout state: `SUCCEEDED`
- Verified live URLs:
  - `https://partner-admin-dev--kvartal-dev.europe-west4.hosted.app/login` -> `200`
  - `https://kvartal-web-dev--kvartal-dev.europe-west4.hosted.app` -> `200`

## Object Dossier Media Storage Slice (2026-05-31)

- Added approved implementation checklist:
  - `docs/19-OBJECT-DOSSIER-CLOUD-STORAGE-PLAN.md`
- Created Cloud Storage bucket:
  - `gs://kvartal-dev-property-assets`
  - location: `europe-west4`
  - public access prevention enabled
  - uniform bucket-level access enabled
- Added bucket CORS config:
  - `infra/gcp/property-assets-cors.json`
  - allowed admin origins include `partner-admin-dev--kvartal-dev.europe-west4.hosted.app` and `kvartal-admin-dev--kvartal-dev.europe-west4.hosted.app`
- Granted `kvartal-office-api@kvartal-dev.iam.gserviceaccount.com` bucket object admin access for upload/read/delete.
- Granted `roles/iam.serviceAccountTokenCreator` on the office API service account to itself so Cloud Run can generate V4 signed POST policies without key files.
- Added Prisma migration:
  - `packages/db/prisma/migrations/202605311_object_dossier_media_storage/migration.sql`
- Applied migration through Cloud Run job:
  - execution: `kvartal-db-migrate-bg6cz`
  - result: completed successfully
- Added media storage schema support:
  - nullable `PropertyMedia.url`
  - GCS `storagePath`
  - media/document metadata fields
  - `PropertyMediaKind`
  - `PropertyDocumentType`
- Added office API support:
  - admin upload policy endpoint
  - admin upload confirm endpoint
  - public media endpoint
  - admin media endpoint
  - serializer keeps `media.url` populated for legacy and GCS media
- Added Next.js proxy routes:
  - `apps/partner-admin`: admin media preview plus upload/confirm proxy routes
  - `apps/kvartal-admin`: admin media preview proxy route
  - `apps/web`: public media proxy route
  - `apps/partner-site`: public media proxy route
- Added `partner-admin` upload UI for object media.
- Verified:
  - Prisma schema validation passed
  - Prisma client generation passed
  - `pnpm exec turbo build --force` passed for all 10 packages
  - `kvartal-office-api` deployed revision `kvartal-office-api-00015-tm5`
  - `kvartal-office-api /readyz` returned database ready after deploy
  - `kvartal-office-api /api/v1/public/objects` still returns legacy `media.url` values
  - `kvartal-office-api` generated a V4 signed POST policy for a KVARTAL object upload
- App Hosting builds created from Git commit `597d044`:
  - `partner-admin-dev`: `build-2026-05-31-media-001`
  - `kvartal-admin-dev`: `build-2026-05-31-media-001`
  - `partner-site-dev`: `build-2026-05-31-media-001`
  - `kvartal-web-dev`: `build-2026-05-31-media-001`
- App Hosting rollouts succeeded:
  - `partner-admin-dev`: `rollout-2026-05-31-media-001`
  - `kvartal-admin-dev`: `rollout-2026-05-31-media-001`
  - `partner-site-dev`: `rollout-2026-05-31-media-001`
  - `kvartal-web-dev`: `rollout-2026-05-31-media-001`
- Live URL checks returned `200`:
  - `https://partner-admin-dev--kvartal-dev.europe-west4.hosted.app/login`
  - `https://kvartal-admin-dev--kvartal-dev.europe-west4.hosted.app/login`
  - `https://partner-site-dev--kvartal-dev.europe-west4.hosted.app/apart4u`
  - `https://kvartal-web-dev--kvartal-dev.europe-west4.hosted.app`

## Partner Admin Media Gallery Fix (2026-05-31)

- Added object media gallery controls to the shared `partner-admin`:
  - uploaded media appears in the object card/gallery;
  - admins can mark one media item as the cover image for the card/showcase;
  - admins can delete image/video/document media from an object.
- API behavior:
  - cover media is represented by `sortOrder = 0`;
  - `PATCH /api/v1/admin/media/{mediaId}` supports `action=set_cover`;
  - `DELETE /api/v1/admin/media/{mediaId}` removes the DB media row and deletes the GCS object when applicable;
  - if a deleted media item was the cover, the API promotes the next available media item.
- Deployed `kvartal-office-api` revision:
  - `kvartal-office-api-00016-c7s`
- Committed and pushed:
  - `5ddecec feat: manage property media gallery`
- Rolled out `partner-admin-dev` from Git:
  - build: `build-2026-05-31-004`
  - rollout: `rollout-2026-05-31-004`
  - rollout state: `SUCCEEDED`
- Verified:
  - `https://partner-admin-dev--kvartal-dev.europe-west4.hosted.app/login` -> `200`
  - Apart4u first media item is now GCS-backed admin media with `sortOrder = 0`.

## Apart4u Partner Site Design Rollout (2026-05-31)

- Reworked `apps/partner-site` Apart4u tenant front page using the approved GitHub Pages reference:
  - `https://avoinvestgroup.github.io/apart4u/`
- Preserved the partner-site factory model:
  - no separate standalone HTML site;
  - Apart4u is implemented as a tenant-specific module inside `apps/partner-site`;
  - public objects still load from the Cloud Run/PostgreSQL shared public inventory.
- Added live Apart4u site features:
  - dark/gold Apart4u hero using `Apart4Upic.jpeg`;
  - RU / EN / GE language switcher (`ka` internally for Georgian);
  - sections for objects, investments, services, about, process, testimonials, contacts;
  - public object cards with cover media from API `media.sortOrder = 0`;
  - filters for object type, market, and country;
  - object detail modal.
- Verified locally:
  - `pnpm --filter partner-site build` passed;
  - `pnpm --filter partner-site lint` passed with only `next/no-img-element` warnings.
- Committed and pushed:
  - `bfff2a9 feat: apply apart4u partner site design`
- Rolled out `partner-site-dev` from Git:
  - build: `build-2026-05-31-apart4u-001`
  - rollout: `rollout-2026-05-31-apart4u-001`
  - rollout state: `SUCCEEDED`
- Verified live URLs:
  - `https://partner-site-dev--kvartal-dev.europe-west4.hosted.app/` -> `200`
  - `https://partner-site-dev--kvartal-dev.europe-west4.hosted.app/apart4u` -> `200`
# Local feature state: Auth Foundation Increment 1A (2026-07-25)

- Feature worktree: `C:\Dev\_worktrees\Kvartal-property-identity-i1a-auth-v2`.
- Branch: `feature/property-identity-i1a-auth-v2`, base `f8a96f97bd1b37408d4cb57bf5887c87d0a28f66`.
- Implemented locally only: Firebase session-cookie BFF flow, strict CSRF/recent-login/logout, two-header Cloud Run client, external identity SSOT/migration, actor middleware/policy registries, owner binding API/UI, one-time bootstrap CLI, idempotency/concurrency, retention helpers and tests.
- No production database migration, IAM edit, deployment, Firebase mutation or bootstrap execution was performed.
- Production prerequisites remain: reauthenticate GCP operator; verify App Hosting/Cloud Run runtime IAM and ADC; configure retention, digest pepper, exact origins and protected bootstrap settings; apply migration through the approved deployment process.

## Property Identity Registry v4 dev deployment (2026-07-25)

- Source branch: `feature/property-identity-v4`.
- Draft PR: `https://github.com/AVOINVESTGROUP/kvartal-demo/pull/1`.
- App Hosting source commit: `96ed283aa5a1b2871dcd175ea33fa81aec814dcf`.
- Pre-migration Cloud SQL backup:
  - backup id: `1784983345803`;
  - operation: `396d0eaf-4a90-4b90-8f89-dd9100000036`;
  - status: `DONE`.
- Secret Manager configuration created without exposing key material:
  - `property-identity-encryption-key-v1`;
  - `property-identity-digest-keys-json`;
  - `external-identity-subject-digest-pepper`.
- Incorrect initial secret versions were disabled before they were attached to any service. Correct cryptographically random version `2` is enabled for all three secrets and is selected through `latest`.
- Cloud Build results:
  - migration image build `068e3e0c-0137-4ece-ae40-d8e9d781c370`: `SUCCESS`;
  - office API build `999954a4-7b35-46a8-acba-f3ec95729e0d`: `SUCCESS`;
  - platform API build `d9824998-ab4a-4535-aaf8-63aef389661c`: `SUCCESS`.
- Database migration:
  - Cloud Run execution `kvartal-db-migrate-w95lf`;
  - status: succeeded;
  - initial crypto metadata version `v1` registered;
  - no authority or rollout policy was seeded.
- Cloud Run API deployment:
  - `kvartal-office-api-00027-tkx`, 100% dev traffic;
  - `kvartal-platform-api-00012-n74`, 100% dev traffic;
  - both `/readyz` checks returned `database=ready`.
- Firebase App Hosting builds from the feature branch:
  - build id `build-property-identity-v4-001` on `partner-admin-dev`, `kvartal-admin-dev` and `fixer-platform-admin-dev`;
  - all build states: `READY`;
  - rollout id `rollout-pi-v4-001` on all three backends;
  - all rollout states: `SUCCEEDED`.
- Live verification:
  - all three `/login` pages return `200`;
  - unauthenticated `/property-identity` redirects to `/login`;
  - actor-protected registry and monitoring API routes return structured `REAUTH_REQUIRED` without a Firebase user session;
  - the existing public object inventory still responds successfully.
- Effective feature state: Property Identity Registry remains `DISABLED` because no rollout policy exists. Existing object creation/publication behaviour therefore remains unchanged until an explicitly approved organisation or market policy is added.
- Remaining acceptance check: sign in with an authorised Firebase user and perform the first end-to-end author workflow after a test authority policy and test organisation rollout are explicitly approved.
- SSOT merge remains blocked until the dirty main-worktree documentation edits are reconciled with this feature branch; see the external conflict report.

## Hosted admin Google Auth dev correction attempt (2026-07-25, superseded)

- Corrected the missing exact `KVARTAL_ADMIN_ORIGIN` App Hosting variable that caused `DEPLOYMENT_PREREQUISITE_MISSING` on the KVARTAL Admin login page.
- A redirect-first Auth change was deployed in `partner-admin`, `kvartal-admin` and `platform-admin` but failed in the live `hosted.app` environment because no same-origin Firebase auth helper/proxy was configured. This approach is superseded and must not be reused as deployed.
- Verified Firebase Auth authorized domains include all three dev `hosted.app` domains.
- Verification passed:
  - `@kvartal/auth`: 18 tests;
  - production Next.js builds for all three admin apps;
  - App Hosting build `build-auth-redirect-001` is `READY` on all three backends and resolves source commit `7cdcb5836e1197f4aee51d8442f3dfba829f3c09`;
  - App Hosting rollout `rollout-auth-redirect-001` is `SUCCEEDED` on all three backends;
  - all three live `/login` pages return `200`;
  - effective environment contains each backend's exact origin variable.
- This rollout is superseded by the subsequent popup Auth correction recorded below.

## Hosted admin Google Auth popup correction (2026-07-25)

- Restored Firebase `signInWithPopup` for `partner-admin`, `kvartal-admin` and `platform-admin`; removed redirect processing and browser session persistence from all three login clients.
- Added `Cross-Origin-Opener-Policy: same-origin-allow-popups` to every admin `/login` response so Firebase can monitor the Google popup without the Chrome COOP conflict.
- Preserved exact App Hosting origin variables, including `KVARTAL_ADMIN_ORIGIN`.
- Added source-contract coverage requiring popup Auth, memory-only Firebase persistence, the compatible COOP header, CSRF exchange and Firebase browser sign-out.
- Local verification passed: 18 auth tests and production Next.js builds for all three admin apps.
- Corrective deployment:
  - source commit `5a18c6b47918857f3979f2f60f66af4bca7f83a8`;
  - build `build-auth-popup-001` is `READY` on all three admin backends;
  - rollout `rollout-auth-popup-001` is `SUCCEEDED` on all three admin backends.
- Live verification on every admin `/login` page:
  - HTTP status `200`;
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups` is present;
  - exact application origin is configured;
  - a session request without a Firebase credential returns the expected `401`, not `DEPLOYMENT_PREREQUISITE_MISSING`.

## Auth Foundation incident Stage 0 (2026-07-25)

- Completed the approved read-only evidence and rollback-matrix stage; no IAM grant, bootstrap, code rollout or traffic change was performed.
- Live tracing proves `POST /api/auth/firebase/session = 200`, followed by `office-api /api/v1/admin/actor-context = 401` and a return to `/login`.
- Actual serving API service accounts have no effective `firebaseauth.users.get` grant at project or organization level. The exact underlying Firebase Admin exception is not logged because current code collapses it to `REAUTH_REQUIRED`; this limitation is recorded rather than inferred away.
- Read-only Cloud SQL evidence: 11 `AppUser` rows, 0 external identities, 0 active external identities and no bootstrap state.
- Created on-demand insurance backup `1785001724586`; status `SUCCESSFUL`.
- Verified both July migrations are additive and prepared a matched rollback matrix covering all three App Hosting builds plus both API revisions and image digests.
- Full evidence and Stage 1 gate: `docs/property-identity-v4/AUTH-INCIDENT-STAGE-0.md`.

## Auth Foundation incident resolved in dev (2026-07-25)

- Permanently granted the minimal read-only `roles/firebaseauth.viewer` role to the actual `kvartal-office-api` and `kvartal-platform-api` runtime service accounts.
- Completed the controlled one-time Firebase platform-owner bootstrap for the existing `abtiurin@gmail.com` application user.
- Verified the database contains one `ACTIVE` Firebase external identity, a `COMPLETED` bootstrap state and its `BOOTSTRAP_COMPLETED` audit event.
- Verified authenticated readiness for both APIs and `200` responses from all three hosted login pages.
- Synthetic end-to-end Firebase session verification passed twice against the currently serving office and platform `/actor-context` routes: both returned `200`, `platform_owner`, two organization memberships and one office membership.
- Deleted temporary Cloud Run jobs, removed temporary operator and signing permissions, disabled the one-time bootstrap secret versions and stopped the local Cloud SQL proxy.
- No application code deployment, traffic switch, rollback or migration reversal was required.
- Resolution report: `docs/property-identity-v4/AUTH-INCIDENT-RESOLUTION.md`.
