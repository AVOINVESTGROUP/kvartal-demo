-- Safety rollback: the former NEW_SUBMISSIONS_ONLY policy pointed partners to
-- the removed standalone registration surface and blocked the normal object form.
-- Unified ingress is re-enabled only after this release passes dev E2E.
UPDATE "PropertyIdentityRolloutPolicy"
SET
  "mode" = 'DISABLED',
  "registryEnabled" = false,
  "publishGateEnabled" = false,
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "mode" <> 'DISABLED'
   OR "registryEnabled" = true
   OR "publishGateEnabled" = true;
