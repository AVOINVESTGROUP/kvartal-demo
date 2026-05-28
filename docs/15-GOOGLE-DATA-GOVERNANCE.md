# Google Data Governance Layer

Status: Stage 3A applied in `kvartal-dev`.

## Applied resources

- Cloud SQL PostgreSQL: transactional SSOT for platform, office, property, AI intake, and legal document records.
- BigQuery datasets in `europe-west4`:
  - `kvartal_raw`
  - `kvartal_curated`
  - `kvartal_governance`
- BigQuery Connection:
  - `kvartal-dev.europe-west4.kvartal_cloudsql`
  - verified with a federated query against PostgreSQL `information_schema`.
- Dataplex lake:
  - `kvartal-governance`
  - zones: `raw`, `curated`
  - assets: `bq-raw`, `bq-curated`, `bq-governance`
- Data Catalog policy tag taxonomy:
  - `KVARTAL Sensitivity`
  - tags: `public`, `internal`, `confidential`, `legal_sensitive`, `personal_data`
- Dataform workspace scaffold:
  - `infra/dataform/workflow_settings.yaml`
  - `infra/dataform/definitions/ssot_table_inventory.sqlx`

## Target operating model

PostgreSQL remains the source of truth for transactional writes. BigQuery is for analytics, monitoring, reconciliation, and AI-readable governed datasets. Dataplex is the catalog/governance layer. Dataform owns repeatable transformations and data quality assertions. Policy tags mark sensitive columns before broader analytics access is granted.

## Next data steps

1. Add Datastream from Cloud SQL to `kvartal_raw` once CDC requirements and cost profile are approved.
2. Create Dataform repository/workspace in Google Cloud and connect it to `infra/dataform`.
3. Attach policy tags to BigQuery columns as raw/curated tables appear.
4. Add Dataform assertions for office isolation, role integrity, legal document confidentiality, and AI verification conflicts.
