ALTER TABLE "SiteConfig" ADD COLUMN IF NOT EXISTS "showPartnerObjects" BOOLEAN NOT NULL DEFAULT true;

INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count"
)
SELECT
  '11111111-2222-4333-8444-202605292001',
  '3eabbf31126be00950f580dbb178fe01389aec3938271a258aa6d6402a85ab5c',
  NOW(),
  '202605292_site_config_show_partner_objects',
  NULL,
  NULL,
  NOW(),
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM "_prisma_migrations"
  WHERE "migration_name" = '202605292_site_config_show_partner_objects'
);
