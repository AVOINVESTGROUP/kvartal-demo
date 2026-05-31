# Object Dossier + Cloud Storage: Implementation Slice 1

Status: approved working plan.

This document is the implementation checklist for object media storage. Agents must check this file before changing media, object dossier, Cloud Storage, or related admin UI code.

## Summary

Build the first object dossier storage slice: photos, videos, and metadata through Cloud Storage and PostgreSQL.

Existing public sites and admin apps must not break. API responses continue to expose `media.url`; for new GCS-backed media this URL is computed in the API serializer and is not stored in the database.

## Key Decisions

- Use Cloud Storage for files.
- Store only paths, metadata, rights, and relationships in PostgreSQL.
- Bucket name is environment configuration: `STORAGE_BUCKET`.
- Do not store generated API paths in DB for GCS media.
- Keep `media.url` populated in API responses for compatibility.
- If a media row has both `storagePath` and legacy `url`, `storagePath` wins.
- Keep `title` and `caption` as plain strings in v1.
- Keep `width`, `height`, and `durationSeconds` nullable until async processing exists.
- Store checksum from GCS `md5Hash`, not from the browser.

## Schema

`PropertyMedia.url` becomes nullable.

Add fields to `PropertyMedia`:

- `storagePath`
- `originalFileName`
- `mimeType`
- `sizeBytes`
- `checksum`
- `title`
- `caption`
- `width`
- `height`
- `durationSeconds`
- `uploadedByUserId`

Add enum `PropertyMediaKind`:

- `image`
- `video`
- `floor_plan`
- `map`
- `render`
- `virtual_tour`
- `drone`
- `other`

Add fields to `PropertyDocument`:

- `originalFileName`
- `mimeType`
- `sizeBytes`
- `checksum`
- `uploadedByUserId`

Add enum `PropertyDocumentType`:

- `floor_plan`
- `presentation`
- `technical_report`
- `explication`
- `certificate`
- `other`

Do not add `MediaProcessingStatus` in this slice. Confirmed uploads are immediately usable.

## API

Admin upload endpoints:

- `POST /api/v1/admin/objects/{id}/media/upload-url`
- `POST /api/v1/admin/objects/{id}/media/confirm`

Admin media management endpoints:

- `PATCH /api/v1/admin/media/{mediaId}` with `action=set_cover`;
- `DELETE /api/v1/admin/media/{mediaId}`.

Media delivery endpoints:

- `GET /api/v1/public/media/{mediaId}`
- `GET /api/v1/admin/media/{mediaId}`

Public media endpoint:

- serves only `public=true` media;
- parent object must be `status=published` and `visibility=public`;
- returns cacheable media.

Admin media endpoint:

- serves draft/private/admin-preview media;
- requires organization access check;
- uses private cache headers.

Object serializers:

- public object context returns `/api/v1/public/media/{mediaId}` for GCS media;
- admin object context returns `/api/v1/admin/media/{mediaId}` for GCS media;
- legacy media returns existing `url`;
- consumers must not receive `media.url = null`.

Cover image rule:

- the media item with `sortOrder = 0` is the card/showcase cover;
- when a newly uploaded item is marked `makeCover`, existing media for the object move behind it;
- if the cover is deleted, the API promotes the next available media item to `sortOrder = 0`;
- legacy URL media remains supported but should not block a newly selected GCS cover.

## Upload Flow

1. Admin UI asks backend for V4 signed upload URL.
2. Backend validates organization access to the property object.
3. Backend issues signed URL with type and size restrictions.
4. Browser uploads directly to GCS.
5. Admin UI calls confirm endpoint.
6. Backend reads GCS metadata, size, content type, and `md5Hash`.
7. Backend rejects invalid files, deletes failed uploads, and does not create active DB media.
8. Backend creates `PropertyMedia` with `storagePath` and metadata.
9. Admin UI refreshes the object list and shows the uploaded media in the object card/gallery.
10. Admin can set any image as the cover or delete obsolete media.

File limits:

- images: 20 MB;
- videos: 500 MB;
- documents: 50 MB.

## Infrastructure

Create bucket:

- name: `kvartal-dev-property-assets`;
- location: `europe-west4`;
- public access prevention enabled.

Bucket CORS must allow browser upload from:

- `https://partner-admin-dev--kvartal-dev.europe-west4.hosted.app`;
- future production/admin domains when created.

`office-api` service account must be able to:

- create objects;
- read objects;
- delete failed uploads.

For V4 signed URLs from Cloud Run, grant signing permission:

- `iam.serviceAccounts.signBlob` on the signing service account;
- do not use service account key files.

Firebase App Hosting frontend service accounts must not receive direct bucket access.

## Cache

Public media:

- `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`;
- `ETag` and/or `Last-Modified`.

Admin media:

- `Cache-Control: private, max-age=300`.

## Migration And Deployment

Migration order:

1. Inspect existing `PropertyMedia.kind`.
2. Normalize unknown values to `other`.
3. Migrate `kind` from String to enum.
4. Make `url` nullable.
5. Add metadata fields.
6. Rebuild `db-migrate` Docker image.
7. Run Cloud Run migration job before API deploy.
8. Deploy API.
9. Deploy `partner-admin`.
10. Check `kvartal-admin`, `apps/web`, and partner sites for media regressions.

All code changes go through Git. Firebase/App Hosting rollouts are created from Git.

## Test Plan

- Legacy media with only `url` still renders.
- New GCS media with `url = null` in DB renders through computed `media.url`.
- Draft/private media is visible in admin endpoint.
- Draft/private media is blocked from public endpoint.
- Admin can select the cover image for a card/showcase.
- Admin can delete image/video/document media from the object gallery.
- Browser upload works from partner-admin domain without CORS error.
- Signed URL generation works in Cloud Run without service account key.
- Oversized or invalid files are rejected and cleaned up.
- API/admin/site builds pass.
- Migration runs before deploy.
