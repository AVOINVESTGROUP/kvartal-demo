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
