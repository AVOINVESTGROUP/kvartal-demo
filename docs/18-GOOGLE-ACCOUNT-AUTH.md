# Google Account Auth for Fixer.guru and Partner Admins

## Decision

Admin access is based on Google accounts, not passwords.

- Fixer.guru owner/team users sign in with Google and are authorized by `PlatformRoleAssignment`.
- Fixer.guru grants `organization_owner` to a partner owner's Gmail.
- The partner organization owner then manages organization employees through the organization admin.

## Required Runtime Configuration

The admin apps need a Google OAuth Web Client:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `FIXER_AUTH_COOKIE_SECRET`

The platform API should receive:

- `FIXER_PLATFORM_OWNER_EMAILS`, comma-separated bootstrap owner Gmail list.
- `PLATFORM_WRITE_TOKEN` or `ADMIN_WRITE_TOKEN`.

## Current Implementation

- `apps/platform-admin` has Google OAuth routes:
  - `/api/auth/google/start`
  - `/api/auth/google/callback`
  - `/logout`
- `apps/platform-admin` checks platform roles before showing the owner console.
- `apps/platform-api` exposes:
  - `GET /api/v1/platform/access`
  - `POST /api/v1/platform/access/platform-member`
  - `POST /api/v1/platform/access/organization-owner`

## Access Flow

1. Owner opens Fixer.guru admin.
2. Owner signs in with Google.
3. Platform API checks the Gmail in PostgreSQL.
4. If the Gmail is in `FIXER_PLATFORM_OWNER_EMAILS`, the API bootstraps `platform_owner`.
5. Owner adds partner organization owners and Fixer.guru team members by Gmail.
