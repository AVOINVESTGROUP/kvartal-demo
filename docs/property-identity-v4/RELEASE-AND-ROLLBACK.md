# Property Identity v4 release and rollback runbook

This runbook is operational guidance only. Completing local implementation does not authorize deployment or production data changes.

## Preconditions

1. Confirm the exact GCP project, database and App Hosting/Cloud Run targets.
2. Restore valid Application Default Credentials under the approved operator account.
3. Back up the target database and record the restore point.
4. Configure encryption and digest keys in Secret Manager; never put key material in the repository or migration command.
5. Deploy the database migration before code that reads the new tables.
6. Deploy APIs, then the existing partner cabinets, then `platform-admin` monitoring.
7. Run authenticated smoke tests with a test organisation while rollout remains `DISABLED`.

## Controlled activation

1. Create inactive authority policies for one test jurisdiction and verify their namespace and normalizer versions.
2. Activate only the reviewed authority policies.
3. Create an organisation-scoped rollout policy in `NEW_SUBMISSIONS_ONLY` with a recorded future `activationAt`.
4. Verify create, correction, unique check, exact-link check, author confirmation, cancellation and publication gating.
5. Monitor failed checks, failed/retrying jobs and recent redacted events.
6. Expand organisation by organisation. Use `STRICT` only after legacy objects in that scope have completed registration.

## Existing-object migration

1. Run the preparation command without `--apply` and review candidate, eligible and skipped counts.
2. Select a real active employee/broker who is responsible for the objects; that user becomes the submission author.
3. Run a small applied batch with explicit environment confirmation.
4. The assigned author opens each draft in the existing cabinet, adds official identifiers, runs the check and confirms create/link.
5. Re-run dry-run and reconcile remaining unprofiled objects. Never convert a draft into verified state with SQL or a bulk script.

## Logical rollback

1. Set the affected organisation rollout policy to `DISABLED` and increment its version.
2. Confirm that legacy create paths are available again and the publication gate is off for that scope.
3. Keep registry tables and audit events intact. Do not delete submissions, profiles, claims or canonical versions.
4. Investigate with redacted monitoring data. Rotate/retire keys through the defined key lifecycle if key exposure is suspected.
5. Roll back application binaries only to a version that is compatible with the already-applied schema.

Disabling rollout stops new registry submissions but preserves existing submissions so authors can read, cancel or safely finish them. A database restore is an emergency action, not the normal feature rollback.
