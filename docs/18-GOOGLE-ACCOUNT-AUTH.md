# Google Account Auth for Fixer.guru and Partner Admins

## Decision

Admin access is based on Google accounts through Firebase Authentication, not passwords and not a hand-written OAuth client.

- Firebase Auth proves the user owns the Google account.
- PostgreSQL platform tables decide what this Google account can do.
- Fixer.guru owner/team users are authorized by `PlatformRoleAssignment`.
- Fixer.guru grants `organization_owner` to a partner owner's Gmail.
- The partner organization owner then manages organization employees through the organization admin.

## Why Firebase Auth

Firebase Auth is the approved path for admin Google sign-in in this Firebase App Hosting project. It avoids manually managing a Google OAuth Web Client ID/secret in application code.

Do not use `gcloud iam oauth-clients` for browser Google sign-in. That creates an IAM OAuth client type and Google Accounts can reject it with `401 invalid_client`.

## Current Implementation

`apps/platform-admin` uses Firebase Web SDK on `/login`:

- client signs in with Google using Firebase Auth;
- client sends Firebase ID token to `/api/auth/firebase/session`;
- server verifies the Firebase token signature, issuer, audience, expiry, email and `email_verified`;
- server asks `platform-api` whether the Gmail has platform access;
- server sets the `fixer_platform_session` cookie only after authorization succeeds.

`apps/platform-admin` no longer uses:

- `/api/auth/google/start`;
- `/api/auth/google/callback`;
- `GOOGLE_OAUTH_CLIENT_ID`;
- `GOOGLE_OAUTH_CLIENT_SECRET`.

## Required Firebase Console Setup

In project `kvartal-dev`, not `capital-index-2026`:

1. Firebase Console -> Authentication -> Sign-in method.
2. Enable Google provider.
3. Authentication -> Settings -> Authorized domains.
4. Add:
   - `fixer-platform-admin-dev--kvartal-dev.europe-west4.hosted.app`
   - `partner-admin-dev--kvartal-dev.europe-west4.hosted.app`
   - `kvartal-admin-dev--kvartal-dev.europe-west4.hosted.app`
   - `kvartal-dev.firebaseapp.com`

If Firebase Auth is in test mode, add test users:

- `office@integrayachtsuae.com`
- `dogecryptoco@gmail.com`

## Runtime Configuration

`apps/platform-admin/apphosting.yaml` contains public Firebase web config:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Use the official Firebase Web App config from project `kvartal-dev`. Do not create ad-hoc API keys for admin sign-in.

The server session still needs a cookie signing secret:

- `FIXER_AUTH_COOKIE_SECRET`, or Secret Manager `fixer-auth-cookie-secret`.

## Platform API Access Flow

1. Owner opens Fixer.guru admin.
2. Owner signs in with Google through Firebase Auth.
3. Platform admin verifies the Firebase ID token.
4. Platform API checks the Gmail in PostgreSQL.
5. The API resolves the verified external identity to an existing `AppUser` and active database memberships. Email never grants or bootstraps a role at request time.
6. The only `platform_owner` account is `office@integrayachtsuae.com`. It is established by an audited one-time administrative procedure, not by an environment email list or an HTTP request.
7. The owner adds partner organization users by Gmail. Organization roles never imply platform-owner rights.

`FIXER_PLATFORM_OWNER_EMAILS` is retired and must not be used by application authorization. Existing values must be removed from runtime configuration after the database role migration is verified.

## 2026-05-31 Partner Admin Domain Fix

`partner-admin-dev--kvartal-dev.europe-west4.hosted.app` was added to Firebase Auth Authorized domains after the partner admin login page returned:

```text
Firebase: Error (auth/unauthorized-domain).
```

The config was updated through the official Identity Toolkit admin API with `updateMask=authorizedDomains` and verified by reading the project config back from `kvartal-dev`.
