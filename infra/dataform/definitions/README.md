# KVARTAL Dataform workspace

Dataform transforms BigQuery raw/federated data into governed marts.

Initial sources:
- `kvartal-dev.europe-west4.kvartal_cloudsql` federated connection to Cloud SQL PostgreSQL SSOT.
- `kvartal_raw` for future Datastream/raw ingestion.
- `kvartal_curated` for governed analytical views.
- `kvartal_governance` for assertions, audit exports, and data quality results.

Dataform repository creation is handled in Google Cloud console/API because the installed `gcloud` build does not expose `gcloud dataform`.
