# ADR 0002: Property Identity v4 Stage 0 integration baseline

Date: 2026-07-25
Status: completed locally; no deployment performed

## Git baseline

- Repository: `https://github.com/AVOINVESTGROUP/kvartal-demo`
- Main worktree: `C:\Dev\Kvartal`
- Main commit: `f8a96f97bd1b37408d4cb57bf5887c87d0a28f66`
- `origin/main`: same commit after `git fetch origin --prune`
- Main worktree was dirty before Stage 0 and was not modified.
- Auth foundation source branch: `feature/property-identity-i1a-auth-v2`
- Auth foundation commit: `c9eef0abb0b26e7de270817ae0e011f412f88263`
- V4 branch: `feature/property-identity-v4`
- V4 worktree: `C:\Dev\_worktrees\Kvartal-property-identity-v4`

The auth branch is four commits ahead of the same main commit. There was no committed main divergence to merge.

## Dirty-document handling

The main worktree has uncommitted changes in four SSOT files also touched by the auth foundation:

- `docs/00-MASTER-ARCHITECTURE.md`;
- `docs/02-DATA-MODEL.md`;
- `docs/03-API-CONTRACTS.md`;
- `docs/CURRENT_STATE.md`.

Stage 0 did not copy, stash, overwrite, commit or otherwise mutate those main-worktree files. Auth additions remain isolated on the feature branch. New v4 decisions are recorded under this new ADR path. Final SSOT reconciliation must occur only after the existing main-worktree edits have an owner-controlled committed form.

## Verified foundation

The inherited auth foundation contains:

- Firebase session-cookie BFF flow;
- strict CSRF, origin and recent-login checks;
- logout revocation flow;
- infrastructure identity in `X-Serverless-Authorization` and end-user session JWT in `Authorization`;
- Firebase session verification with revocation checking;
- `AppUserExternalIdentity` as external identity SSOT;
- database-derived immutable `ActorContext` and memberships;
- audited external identity binding/recovery;
- one-time platform-owner bootstrap CLI;
- mutation idempotency and retention helpers.

## Verification evidence

Commands and results:

- `pnpm install --frozen-lockfile`: completed; optional `cpu-features` native build warned because Python 3.13 lacks `distutils`, but pnpm exited successfully.
- `pnpm --filter @kvartal/db prisma:generate`: passed.
- `pnpm --filter @kvartal/db prisma:validate` with a non-secret local placeholder URL: passed.
- `pnpm --filter @kvartal/auth test`: 13/13 tests passed.
- `pnpm --filter @kvartal/platform-api test`: 3/3 tests passed after building the workspace auth package.
- `pnpm --filter @kvartal/db test`: 2/2 integration tests passed.
- DB integration tests deployed all migrations to disposable Testcontainers PostgreSQL 16.
- `pnpm exec turbo build --force`: 10/10 package builds passed.

Total auth/platform/DB tests: 18/18 passed.

## External prerequisites not changed

Read-only GCP inspection found:

- active gcloud account: `office@integrayachtsuae.com`;
- active gcloud project: `avo-deal-sniper`, not `kvartal-dev`;
- Application Default Credentials require interactive reauthentication.

No gcloud project switch, login, IAM edit, Firebase mutation, deployment, production database migration or blockchain operation was performed.

Before any staging/deployment action, an authorised operator must:

1. authenticate ADC interactively;
2. select/verify project `kvartal-dev` explicitly;
3. verify App Hosting and Cloud Run service identities and invoker roles;
4. configure exact origins, retention, digest pepper and bootstrap controls through approved secrets/configuration;
5. approve the target environment and deployment step.

## Stage 0 outcome

The local v4 implementation baseline is ready for Stage 1 design/code work in the isolated worktree. Registry feature flags remain absent/off, and no runtime environment was changed.
