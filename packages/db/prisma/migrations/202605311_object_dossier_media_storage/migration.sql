CREATE TYPE "PropertyMediaKind" AS ENUM (
  'image',
  'video',
  'floor_plan',
  'map',
  'render',
  'virtual_tour',
  'drone',
  'other'
);

CREATE TYPE "PropertyDocumentType" AS ENUM (
  'floor_plan',
  'presentation',
  'technical_report',
  'explication',
  'certificate',
  'other'
);

UPDATE "PropertyMedia"
SET "kind" = 'other'
WHERE "kind" NOT IN ('image', 'video', 'floor_plan', 'map', 'render', 'virtual_tour', 'drone', 'other');

UPDATE "PropertyDocument"
SET "documentType" = 'other'
WHERE "documentType" NOT IN ('floor_plan', 'presentation', 'technical_report', 'explication', 'certificate', 'other');

ALTER TABLE "PropertyMedia"
  ALTER COLUMN "url" DROP NOT NULL,
  ALTER COLUMN "kind" DROP DEFAULT,
  ALTER COLUMN "kind" TYPE "PropertyMediaKind" USING "kind"::"PropertyMediaKind",
  ALTER COLUMN "kind" SET DEFAULT 'image',
  ADD COLUMN "originalFileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" BIGINT,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "uploadedByUserId" TEXT;

ALTER TABLE "PropertyDocument"
  ALTER COLUMN "documentType" DROP DEFAULT,
  ALTER COLUMN "documentType" TYPE "PropertyDocumentType" USING "documentType"::"PropertyDocumentType",
  ALTER COLUMN "documentType" SET DEFAULT 'other',
  ADD COLUMN "originalFileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" BIGINT,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "uploadedByUserId" TEXT;

CREATE INDEX "PropertyMedia_uploadedByUserId_idx" ON "PropertyMedia"("uploadedByUserId");
CREATE INDEX "PropertyDocument_uploadedByUserId_idx" ON "PropertyDocument"("uploadedByUserId");

ALTER TABLE "PropertyMedia"
  ADD CONSTRAINT "PropertyMedia_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PropertyDocument"
  ADD CONSTRAINT "PropertyDocument_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
