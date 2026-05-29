# Firebase App Hosting Troubleshooting Log

This file records deployment problems and proven fixes for KVARTAL Firebase App Hosting.

## 2026-05-29: Google OAuth `401 invalid_client` in Platform Admin

### Symptoms

- `/login` redirected to Google Accounts.
- Google showed `The OAuth client was not found`.
- Error: `401 invalid_client`.

### Root Cause

The client id was created with `gcloud iam oauth-clients`. That is not the normal Firebase/Google Auth Platform Web OAuth client used by browser Google sign-in.

### Fix

Stop using the hand-written OAuth routes and move platform admin sign-in to Firebase Authentication:

- `/login` uses Firebase Web SDK and Google provider.
- client posts Firebase ID token to `/api/auth/firebase/session`.
- server verifies the Firebase ID token and then asks `platform-api` for Gmail authorization.

Do not store a fallback Google OAuth client id in code. Do not use `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` for `platform-admin`.
Do not create a separate ad-hoc API key for Firebase Auth. Use the official Firebase Web App config from `kvartal-dev`.

### Required Console Check

In Firebase project `kvartal-dev`, enable Authentication -> Sign-in method -> Google and add the App Hosting domain to Authorized domains:

```text
fixer-platform-admin-dev--kvartal-dev.europe-west4.hosted.app
```

## 2026-05-29: App Hosting Build Succeeds Locally but Firebase Shows Old/Fallback Data

### Symptoms

- Firebase App Hosting rollout was green, but the live site rendered fallback inventory.
- `PUBLIC_API_BASE_URL` was not available in the App Hosting build/runtime config.
- The live HTML contained `fallback-moscow` instead of PostgreSQL / Cloud Run API data.

### Root Cause

`kvartal-web-dev` has `codebase.rootDirectory = "/"`, because the main web app is built from the monorepo root.  
Firebase App Hosting only read `apphosting.yaml` from the backend root directory, so `apps/web/apphosting.yaml` was ignored.

### Fix

Add root-level `apphosting.yaml` for `kvartal-web-dev`:

```yaml
kind: "AppStack"
schemaVersion: "v1"
runConfig:
  concurrency: 80
  cpu: 1
  memoryMiB: 1024
env:
  - variable: NEXT_TELEMETRY_DISABLED
    value: "1"
  - variable: PORT
    value: "8080"
  - variable: PUBLIC_API_BASE_URL
    value: "https://kvartal-office-api-544286782827.europe-west4.run.app"
```

### Verification

Check the build config:

```powershell
$access = gcloud auth print-access-token
Invoke-RestMethod -Uri "https://firebaseapphosting.googleapis.com/v1beta/projects/kvartal-dev/locations/europe-west4/backends/kvartal-web-dev/builds/<BUILD_ID>" -Headers @{Authorization="Bearer $access"} | ConvertTo-Json -Depth 20
```

Expected:

- `PUBLIC_API_BASE_URL` exists in `config.effectiveEnv`.
- `origin = APPHOSTING_YAML`.
- `originFileName = apphosting.yaml`.

## 2026-05-29: Firebase Build Failed Although Target App Was Web

### Symptoms

- App Hosting build failed for `kvartal-web-dev`.
- The web app built locally, but Cloud Build failed inside monorepo `turbo build`.
- Failure came from `@kvartal/platform-api` or `@kvartal/office-api` TypeScript errors.

### Root Cause

Firebase App Hosting executed the root monorepo build, not only `apps/web`. Therefore any package in `turbo build` can break the web rollout.

### Fix

Before creating a Firebase build, run:

```powershell
pnpm --filter @kvartal/platform-api build
pnpm --filter @kvartal/office-api build
pnpm --filter web exec next build --debug
```

When a Prisma generated helper type is missing in Cloud Build, prefer stable local row types instead of depending on generated `Prisma.*GetPayload` helper availability.

## 2026-05-29: next/font Broke Cloud Build

### Symptoms

- Local/Cloud build failed or hung while downloading Google Fonts.
- App Hosting environment could not reliably reach `fonts.gstatic.com`.

### Fix

Remove `next/font/google` from `apps/web/src/app/layout.tsx` and use the project/system font stack through CSS/Tailwind.

## 2026-05-29: Database Seed Created Duplicate Public Objects

### Symptoms

- Public API returned 18 objects instead of 9.
- Old objects had no `PropertyMedia`.
- New localized records were created because seed lookup changed from old English titles to Russian titles.

### Root Cause

`ensurePublishedObject` matched objects by localized title. When titles were localized, it created new rows and left old seed rows.

### Fix

Seed now removes published public objects without media after recreating canonical media-backed rows:

```ts
await prisma.propertyObject.deleteMany({
  where: {
    status: "published",
    visibility: "public",
    media: { none: {} },
  },
});
```

### Verification

```powershell
$token = gcloud auth print-identity-token
$json = (Invoke-WebRequest -Uri "https://kvartal-office-api-544286782827.europe-west4.run.app/api/v1/public/objects?tenant=kvartal&language=ru&limit=20" -Headers @{Authorization="Bearer $token"} -UseBasicParsing).Content | ConvertFrom-Json
[pscustomobject]@{
  count = $json.objects.Count
  mediaMissing = ($json.objects | Where-Object {$_.media.Count -eq 0}).Count
}
```

Expected:

- `count = 9`
- `mediaMissing = 0`

## 2026-05-29: Firebase CLI Reauth Blocks App Hosting, Use REST with gcloud Token

### Symptoms

- `firebase apphosting:*` fails with `Authentication Error: Your credentials are no longer valid. Please run firebase login --reauth`.
- `gcloud apphosting` is not available in the installed gcloud component set.

### Fix

Use Firebase App Hosting REST API with a fresh gcloud access token:

```powershell
$access = gcloud auth print-access-token
$body = @{ source = @{ codebase = @{ branch = "main" } }; displayName = "kvartal-admin-management" } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post `
  -Uri "https://firebaseapphosting.googleapis.com/v1beta/projects/kvartal-dev/locations/europe-west4/backends/kvartal-admin-dev/builds?buildId=build-YYYY-MM-DD-NNN" `
  -Headers @{Authorization="Bearer $access"; "Content-Type"="application/json"} `
  -Body $body
```

After the build state is `READY`, create a rollout:

```powershell
$body = @{ build = "projects/kvartal-dev/locations/europe-west4/backends/kvartal-admin-dev/builds/build-YYYY-MM-DD-NNN" } | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "https://firebaseapphosting.googleapis.com/v1beta/projects/kvartal-dev/locations/europe-west4/backends/kvartal-admin-dev/rollouts?rolloutId=rollout-YYYY-MM-DD-NNN" `
  -Headers @{Authorization="Bearer $access"; "Content-Type"="application/json"} `
  -Body $body
```

### Verification

```powershell
$html = (Invoke-WebRequest -Uri "https://kvartal-admin-dev--kvartal-dev.europe-west4.hosted.app" -UseBasicParsing).Content
$html.Contains("Добавить объект")
$html.Contains("Редактировать карточку")
$html.Contains("Опубликовать в витрине")
```

## 2026-05-29: Cloud Run API in Monorepo Needs Root Build Context

### Symptoms

- `apps/office-api/Dockerfile` copies root workspace files and `packages/*`.
- Building from `apps/office-api` alone is not enough.

### Fix

Use `cloudbuild.office-api.yaml` from the repository root:

```powershell
gcloud builds submit . `
  --config=cloudbuild.office-api.yaml `
  --substitutions=_IMAGE=europe-west4-docker.pkg.dev/kvartal-dev/kvartal/office-api:<tag> `
  --project=kvartal-dev
```

Deploy to Cloud Run while preserving Cloud SQL and Secret Manager configuration:

```powershell
gcloud run deploy kvartal-office-api `
  --image=europe-west4-docker.pkg.dev/kvartal-dev/kvartal/office-api:<tag> `
  --region=europe-west4 `
  --project=kvartal-dev `
  --service-account=kvartal-office-api@kvartal-dev.iam.gserviceaccount.com `
  --add-cloudsql-instances=kvartal-dev:europe-west4:kvartal-dev-postgres `
  --set-secrets=DATABASE_URL=kvartal-database-url:latest
```

## 2026-05-29: App Hosting Secret Resolution and Next Proxy Runtime Env

### Symptoms

- App Hosting build fails with `fah/misconfigured-secret` even after direct Secret Manager IAM bindings.
- Next `proxy.ts` cannot rely on runtime-only Cloud Run secrets, because middleware/proxy code may be evaluated with build-time env.
- Browser URL returns `Admin authentication is not configured` although Cloud Run service env contains the secret.

### Fix Used

- Keep secrets out of `apps/kvartal-admin/apphosting.yaml` until Firebase CLI auth can run `firebase apphosting:secrets:grantaccess`.
- Enforce admin auth in the server page and server actions, where runtime env is available.
- After App Hosting rollout, patch the managed Cloud Run service with runtime secrets:

```powershell
gcloud run services update kvartal-admin-dev `
  --region=europe-west4 `
  --project=kvartal-dev `
  --update-secrets="KVARTAL_ADMIN_BASIC_AUTH=kvartal-admin-basic-auth:latest,KVARTAL_ADMIN_SESSION_TOKEN=kvartal-admin-session-token:latest" `
  --quiet
```

### Verification

Unauthenticated admin URL should redirect to `/login`:

```powershell
try {
  Invoke-WebRequest -Uri "https://kvartal-admin-dev--kvartal-dev.europe-west4.hosted.app" -UseBasicParsing -MaximumRedirection 0
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.Exception.Response.Headers["Location"]
}
```

With a valid `kvartal_admin_session` cookie from Secret Manager, the page should return `200`.
