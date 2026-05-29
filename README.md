# KVARTAL / Fixer.guru Real Estate Partner Platform

## Overview

KVARTAL is now part of the Fixer.guru partner-network real estate platform.

Fixer.guru owns and operates the platform. Partner organizations such as KVARTAL Moscow, Apart4u.co Tbilisi, and future Dubai/Yerevan partners use the shared database, branded public sites, and organization admin tools.

The current source of truth is:

- [`docs/00-MASTER-ARCHITECTURE.md`](docs/00-MASTER-ARCHITECTURE.md)
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)

## Core Model

```text
Fixer.guru platform
-> partner organizations
-> partner public sites
-> shared public inventory
-> partner organization admin
-> leads / co-broker requests / deal rooms
```

Key rules:

- Cloud SQL/PostgreSQL is the transactional SSOT.
- Property contributors remain information rights holders.
- Partner sites can display eligible shared public inventory in their own design.
- Leads belong to the source partner site/organization.
- Admin access uses Firebase Google Auth plus PostgreSQL roles and memberships.
- Frontend apps are hosted on Firebase App Hosting.
- Backend writes go through Cloud Run APIs.

## Active Apps

- `apps/web` - KVARTAL public site / platform public site.
- `apps/platform-admin` - Fixer.guru owner console.
- `apps/partner-admin` - target universal organization admin.
- `apps/partner-site` - multi-tenant branded partner websites.
- `apps/kvartal-admin` - current working KVARTAL organization admin baseline.
- `apps/platform-api` - platform owner Cloud Run API.
- `apps/office-api` - current partner/public operations Cloud Run API; target product name is `partner-api/public-api`.

## Developer Setup

See [`docs/10-DEVELOPER-SETUP.md`](docs/10-DEVELOPER-SETUP.md).

Useful checks:

```powershell
pnpm build
pnpm --filter @kvartal/office-api build
pnpm --filter @kvartal/db prisma:validate
```

## Documentation

Use [`docs/00-MASTER-ARCHITECTURE.md`](docs/00-MASTER-ARCHITECTURE.md) first.

Historical documents that no longer define the current architecture are archived in [`docs/archived/superseded/`](docs/archived/superseded/).

## Non-Negotiable Rules

- Root `index.html` is an approved design reference and must not be modified.
- Do not commit secrets.
- Do not use Angular.
- Do not use Vercel as primary production hosting.
- Do not treat CRM as the object SSOT.
- Do not claim a file has broken encoding based only on terminal output; verify the file itself first.
