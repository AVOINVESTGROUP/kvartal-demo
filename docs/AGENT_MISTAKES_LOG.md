# AGENT MISTAKES LOG

| Дата | Ошибка | Причина | Как избежать |
|---|---|---|---|
| 2026-05-20 | Попытка использования `multi_replace_string_in_file` | Инструмент отключен в данной конфигурации | Всегда проверять список доступных инструментов в системном промпте |
| 2026-05-20 | Попытка перезаписать существующий файл через `create_file` | Инструмент не предназначен для редактирования | Использовать `replace_string_in_file` или `insert_edit_into_file` для существующих файлов |

## 2026-05-31

| Mistake | Cause | Prevention |
|---|---|---|
| Changed and pushed `apps/partner-admin` code without first applying the existing App Hosting troubleshooting checklist | Existing docs already said `kvartal-web-dev` can run root `turbo build` and that deployment is Git-driven; the agent built only the target app and did not verify the target App Hosting backend rollout | Before any App Hosting-related push or rollout: read `docs/CURRENT_STATE.md` and `docs/FIREBASE_APP_HOSTING_TROUBLESHOOTING.md`, run `pnpm exec turbo build --force`, verify the exact backend build/rollout source commit, and record the result |

## 2026-07-25

| Mistake | Cause | Prevention |
|---|---|---|
| Added two new ADR files to the dirty main worktree before moving them to the isolated v4 worktree | `apply_patch` resolved relative paths from the primary workspace rather than the shell command's separate worktree | For every edit targeting a secondary worktree, use an explicit path relative to the primary workspace such as `../_worktrees/<worktree>/...`, then verify both worktree statuses before staging |
| Created disabled first versions of three dev secrets before discovering that static `RandomNumberGenerator.Fill` was unavailable in the installed PowerShell/.NET runtime | The command continued after a non-terminating PowerShell method error and zero-initialized byte arrays were encoded | Set `$ErrorActionPreference = 'Stop'` for security provisioning, use `RandomNumberGenerator.Create().GetBytes(...)`, validate lengths before writes, add corrected versions, and disable every invalid version before attaching secrets to a service |
| API images passed local monorepo builds but failed in clean Cloud Build because new workspace packages were neither built nor copied into the runtime stage | Local workspace already contained package build output, hiding incomplete Docker build graphs | Every Dockerfile must copy dependency manifests before install, build workspace runtime dependencies explicitly, and copy their package metadata, `dist` and required `node_modules` into the runner; validate through the clean Cloud Build path before migration/deploy |
| The first local Docker recheck copied host workspace `node_modules` into the Linux build context and broke Prisma's workspace link | The repository had no `.dockerignore`, while Cloud Build's generated ignore rules had hidden the same problem remotely | Keep a root `.dockerignore` excluding all host dependencies, build output, VCS data, environment files and logs so local and remote container builds start from the same clean source graph |
| `kvartal-admin-dev` was rolled out without `KVARTAL_ADMIN_ORIGIN`, so the production CSRF/session route correctly returned `DEPLOYMENT_PREREQUISITE_MISSING` | The new strict origin requirement was implemented in code but the dedicated cabinet's App Hosting environment was not included in the deployment preflight | Keep source-contract tests that verify every authenticated App Hosting app declares its exact origin variable, and inspect `config.effectiveEnv` before rollout acceptance |
| Replaced popup Auth with `signInWithRedirect` across all hosted admin apps without implementing Firebase's required same-origin auth helper/proxy | Modern browsers block the cross-origin storage used by redirect Auth when the app is not served from the configured Firebase Hosting auth domain | For App Hosting `hosted.app` cabinets, keep popup Auth with `Cross-Origin-Opener-Policy: same-origin-allow-popups`; do not use redirect Auth until the documented same-origin proxy and OAuth redirect URIs are implemented and tested end to end |
