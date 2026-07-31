# Auth Foundation incident: Stage 0 evidence and rollback preparation

Date: 2026-07-25

Environment: `kvartal-dev` only

Status: Stage 0 completed with one explicitly recorded evidence limitation. No IAM grant, bootstrap, code rollout, traffic change or Firebase user mutation was performed.

## 1. Confirmed request chain

The live `partner-admin` request chain proves that the Google/Firebase browser step and BFF session exchange are not the current primary failure:

1. `2026-07-25T17:10:08.860391Z` — `GET /api/auth/csrf` returned `200`.
2. `2026-07-25T17:10:09.077934Z` — `POST /api/auth/firebase/session` returned `200`; Cloud Run trace `259b35aa81acb33342151a3d1383a4d0`.
3. `2026-07-25T17:10:09.810546Z` — authenticated navigation requested `/`.
4. `2026-07-25T17:10:10.209169Z` — `kvartal-office-api /api/v1/admin/actor-context` returned `401`; Cloud Run trace `0bdc830c88592476151949028a1e5a9f`.
5. `2026-07-25T17:10:10.922840Z` — the frontend requested `/login?_rsc=...`, completing the false login loop.

The same `actor-context = 401` behavior is present in earlier traces at `2026-07-25T14:26:18.805799Z` and `2026-07-25T14:26:35.847057Z`.

### Evidence limitation

The exact underlying Firebase Admin exception cannot be recovered from the completed request because:

- `resolveUserActor` maps every `verifySessionCookie` exception to `REAUTH_REQUIRED`;
- the API response handler maps the result to the same `401`;
- the frontend catches the backend failure and returns `null`;
- no Firebase Admin error code is written to Cloud Logging;
- Data Access logs contain no underlying Firebase error for this request;
- the current operator cannot impersonate either API service account for a direct `accounts:lookup` permission probe;
- Policy Troubleshooter is disabled and was not enabled during Stage 0.

Therefore this report does not claim that an unlogged `auth/insufficient-permission` string was observed. It records the runtime `401`, the exact traces and the independently verified missing effective permission below. Capturing the original provider error requires a separately approved typed-error/diagnostic change before or together with Stage 1.

## 2. Runtime identities and IAM evidence

Current serving revisions and runtime service accounts:

| Service | Serving revision | Traffic | Runtime service account |
|---|---|---:|---|
| `kvartal-office-api` | `kvartal-office-api-00027-tkx` | 100% | `kvartal-office-api@kvartal-dev.iam.gserviceaccount.com` |
| `kvartal-platform-api` | `kvartal-platform-api-00012-n74` | 100% | `kvartal-platform-api@kvartal-dev.iam.gserviceaccount.com` |
| all three App Hosting admin backends | `build-auth-popup-001` generated Cloud Run revisions | 100% through successful rollout | `firebase-app-hosting-compute@kvartal-dev.iam.gserviceaccount.com` |

Projects are aligned:

- Firebase browser project: `kvartal-dev`;
- BFF Firebase Admin project from `FIREBASE_CONFIG`: `kvartal-dev`;
- API Firebase project: `kvartal-dev`;
- Cloud Run project: `kvartal-dev`.

IAM policy snapshot:

- project policy etag: `BwZWhCMPN_A=`;
- organization `660905108047` policy etag: `BwZSs9v_7YQ=`;
- neither project nor organization policy grants `roles/firebaseauth.viewer`, `firebaseauth.users.get`, or a broader Firebase Auth role to the two API runtime service accounts;
- `roles/firebaseauth.viewer` includes `firebaseauth.users.get` and no user mutation permission;
- App Hosting runtime has `roles/firebase.sdkAdminServiceAgent`, which includes `firebaseauth.users.createSession` and explains the successful session endpoint.

Do not resolve this by setting `checkRevoked=false`; that would weaken the accepted session revocation model.

## 3. Current release matrix

### App Hosting

All three current admin backends use source commit `5a18c6b47918857f3979f2f60f66af4bca7f83a8`:

| Backend | Build | Rollout | State |
|---|---|---|---|
| `partner-admin-dev` | `build-auth-popup-001` | `rollout-auth-popup-001` | `READY` / `SUCCEEDED` |
| `kvartal-admin-dev` | `build-auth-popup-001` | `rollout-auth-popup-001` | `READY` / `SUCCEEDED` |
| `fixer-platform-admin-dev` | `build-auth-popup-001` | `rollout-auth-popup-001` | `READY` / `SUCCEEDED` |

Exact admin origins and `NEXT_PUBLIC_FIREBASE_PROJECT_ID=kvartal-dev` are present in effective configuration. No secret values are recorded in this report.

### Cloud Run APIs

| Service | Revision | Image digest |
|---|---|---|
| `kvartal-office-api` | `kvartal-office-api-00027-tkx` | `sha256:1aba67b891d5625d4fb7884e48d82c3174ee76fd1b97b49e778b7cd42bcaf05b` |
| `kvartal-platform-api` | `kvartal-platform-api-00012-n74` | `sha256:526e2d6c6ba8ce6a216b01045b71d1a0bd5e05b244674862376fd8793cbf4a95` |

Both APIs use the correct dedicated runtime service accounts shown above.

### Secret references resolved at Stage 0

Runtime configuration uses `latest`; the enabled versions resolving at evidence time are:

| Secret | Enabled version used by `latest` |
|---|---:|
| `kvartal-database-url` | 2 |
| `kvartal-admin-write-token` | 1 |
| `fixer-auth-cookie-secret` | 1 |
| `property-identity-encryption-key-v1` | 2 |
| `property-identity-digest-keys-json` | 2 |
| `external-identity-subject-digest-pepper` | 2 |

Version 1 of each new Property Identity/Auth cryptographic secret remains disabled.

## 4. Database evidence

Read-only Cloud SQL inspection returned:

```text
AppUser                         11
AppUserExternalIdentity         0
ACTIVE external identities      0
legacy google:* firebaseUid      8
ExternalIdentityBootstrapState  0
```

Applied migrations:

| Migration | Finished | Rolled back |
|---|---|---|
| `202607231_external_identity_auth_foundation` | `2026-07-25T12:56:05.389Z` | no |
| `20260725105755_property_identity_v4_foundation` | `2026-07-25T12:56:05.737Z` | no |

The zero identity and bootstrap counts prove that fixing IAM alone cannot restore access. After Firebase verification succeeds, an unbound user must receive `403 IDENTITY_BINDING_REQUIRED` until the controlled first-owner bootstrap and normal binding workflow are completed.

Static migration inspection confirms both migrations are additive:

- no `DROP` statements;
- no `DELETE` statements;
- no `UPDATE` of existing data;
- no alteration of pre-existing tables;
- only new enums, tables, indexes, constraints and initial Property Identity crypto-key metadata were added.

Older application revisions may ignore these new tables; the database migration must not be reversed for a normal application rollback.

## 5. Backup and recovery evidence

Cloud SQL instance: `kvartal-dev-postgres`, PostgreSQL 16, state `RUNNABLE`.

- automated backups: enabled;
- retained backups: 7;
- transaction log retention setting: 7 days;
- `pointInTimeRecoveryEnabled` is not present as enabled and transactional log storage state is unspecified; PITR must not be claimed as available without a separate configuration change and verification;
- deletion protection: disabled.

Stage 0 insurance backup:

| Backup ID | Type | Status | Description | Completed |
|---|---|---|---|---|
| `1785001724586` | `ON_DEMAND` | `SUCCESSFUL` | `stage0-auth-incident-pre-iam-20260725` | `2026-07-25T17:49:25.202Z` |

Earlier pre-migration backup `1784983345803` also remains successful. A database restore is not the normal rollback for this incident.

## 6. Matched application rollback set

The last pre-Auth-Foundation artifacts are still available and `READY`/`True`:

| Component | Rollback artifact | Source/image digest |
|---|---|---|
| `partner-admin-dev` | `build-20260604-ai-001` | `5517815010f6ccdb7ab5f739b6bc21122429358a` |
| `kvartal-admin-dev` | `build-2026-06-02-001` | `9962717a90f2f446fed50ab66ca00eebedfbd11a` |
| `fixer-platform-admin-dev` | `b-0611-orgs-001` | `f8a96f97bd1b37408d4cb57bf5887c87d0a28f66` |
| `kvartal-office-api` | `kvartal-office-api-00026-qvs` | `sha256:2dcfa5611065da1587d340b5921f97381dd80ed6ee43b822b99d0ce2888f7012` |
| `kvartal-platform-api` | `kvartal-platform-api-00011-pt6` | `sha256:f5e54bf1f1070b4df56a856474cd42db616b7830acc0ca5ecfcde1724d49db02` |

Compatibility basis:

- these frontends predate the External Identity session-cookie cutover and use the legacy cabinet session flow;
- the two API revisions predate `/actor-context` enforcement;
- both new migrations are additive and do not alter legacy tables or data;
- current new APIs still expose legacy routes, but the approved emergency rollback target is the complete matched set, not an isolated frontend rollback.

### Prepared rollback order — not executed

1. Reconfirm the five artifacts and current traffic immediately before action.
2. Roll all three App Hosting backends to the exact builds above using new incident-specific rollout IDs.
3. Verify legacy login/session behavior against the still-current APIs.
4. Move `kvartal-office-api` traffic to `kvartal-office-api-00026-qvs` and `kvartal-platform-api` traffic to `kvartal-platform-api-00011-pt6`.
5. Verify health/readiness, platform access, organisation context, object reads/writes and logout.
6. Leave both additive migrations and all new tables intact.

No rollback command was executed during Stage 0.

## 7. Stage 1 gate

Before any IAM mutation or bootstrap, the owner must review this report and explicitly approve Stage 1. Stage 1 must:

1. grant only `roles/firebaseauth.viewer` to the actual serving API service accounts in `kvartal-dev`;
2. wait for propagation;
3. perform a real runtime `actor-context` probe;
4. distinguish Firebase provider/IAM failure from `IDENTITY_BINDING_REQUIRED` without erasing the valid frontend cookie;
5. stop before bootstrap if the result remains `401` or the exact provider error contradicts the IAM diagnosis.

Popup/redirect behavior is outside Stage 1 and must remain unchanged.
