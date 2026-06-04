ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'ownership_certificate';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'cadastral_extract';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'title_document';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'lease_agreement';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'sale_purchase_agreement';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'power_of_attorney';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'corporate_document';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'passport_or_id';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'tax_document';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'encumbrance_certificate';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'technical_passport';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'permit';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'due_diligence_report';
ALTER TYPE "PropertyDocumentType" ADD VALUE IF NOT EXISTS 'valuation_report';

CREATE TYPE "PropertyDocumentSource" AS ENUM ('manual', 'google_drive');
CREATE TYPE "PropertyDocumentAnalysisStatus" AS ENUM ('pending', 'analyzing', 'analyzed', 'failed');
CREATE TYPE "PropertyAIProposalStatus" AS ENUM ('pending', 'accepted', 'rejected', 'superseded');

ALTER TABLE "PropertyDocument"
  ADD COLUMN "source" "PropertyDocumentSource" NOT NULL DEFAULT 'manual',
  ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "driveFileId" TEXT,
  ADD COLUMN "driveModifiedTime" TIMESTAMP(3),
  ADD COLUMN "driveChecksum" TEXT,
  ADD COLUMN "driveWebUrl" TEXT,
  ADD COLUMN "analysisStatus" "PropertyDocumentAnalysisStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "aiSummary" JSONB,
  ADD COLUMN "aiFacts" JSONB,
  ADD COLUMN "aiRisks" JSONB,
  ADD COLUMN "aiRecommendations" JSONB,
  ADD COLUMN "aiMissingItems" JSONB,
  ADD COLUMN "aiConflicts" JSONB,
  ADD COLUMN "aiChangeSummary" JSONB,
  ADD COLUMN "aiAnalyzedAt" TIMESTAMP(3);

CREATE TABLE "PropertyDocumentVersion" (
  "id" TEXT NOT NULL,
  "propertyDocumentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "originalFileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "checksum" TEXT,
  "driveModifiedTime" TIMESTAMP(3),
  "driveChecksum" TEXT,
  "aiAnalysis" JSONB,
  "aiChangeSummary" JSONB,
  "comparedToVersion" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyObjectAIAnalysis" (
  "id" TEXT NOT NULL,
  "propertyObjectId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "officeId" TEXT NOT NULL,
  "status" "PropertyDocumentAnalysisStatus" NOT NULL DEFAULT 'analyzed',
  "provider" TEXT,
  "model" TEXT,
  "summary" JSONB,
  "confirmedFacts" JSONB,
  "risks" JSONB,
  "recommendations" JSONB,
  "missingDocuments" JSONB,
  "conflicts" JSONB,
  "changeLog" JSONB,
  "fieldProposals" JSONB,
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyObjectAIAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyObjectAIFieldProposal" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "propertyObjectId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "currentValue" JSONB,
  "proposedValue" JSONB,
  "sourceDocumentIds" TEXT[],
  "confidence" "SourceConfidence" NOT NULL DEFAULT 'medium',
  "rationale" TEXT,
  "status" "PropertyAIProposalStatus" NOT NULL DEFAULT 'pending',
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyObjectAIFieldProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyDocument_driveFileId_idx" ON "PropertyDocument"("driveFileId");
CREATE UNIQUE INDEX "PropertyDocument_propertyObjectId_driveFileId_key" ON "PropertyDocument"("propertyObjectId", "driveFileId");
CREATE UNIQUE INDEX "PropertyDocumentVersion_propertyDocumentId_versionNumber_key" ON "PropertyDocumentVersion"("propertyDocumentId", "versionNumber");
CREATE INDEX "PropertyDocumentVersion_propertyDocumentId_createdAt_idx" ON "PropertyDocumentVersion"("propertyDocumentId", "createdAt");
CREATE INDEX "PropertyObjectAIAnalysis_propertyObjectId_analyzedAt_idx" ON "PropertyObjectAIAnalysis"("propertyObjectId", "analyzedAt");
CREATE INDEX "PropertyObjectAIAnalysis_organizationId_idx" ON "PropertyObjectAIAnalysis"("organizationId");
CREATE INDEX "PropertyObjectAIAnalysis_officeId_idx" ON "PropertyObjectAIAnalysis"("officeId");
CREATE INDEX "PropertyObjectAIFieldProposal_analysisId_idx" ON "PropertyObjectAIFieldProposal"("analysisId");
CREATE INDEX "PropertyObjectAIFieldProposal_propertyObjectId_status_idx" ON "PropertyObjectAIFieldProposal"("propertyObjectId", "status");
CREATE INDEX "PropertyObjectAIFieldProposal_organizationId_idx" ON "PropertyObjectAIFieldProposal"("organizationId");

ALTER TABLE "PropertyDocumentVersion"
  ADD CONSTRAINT "PropertyDocumentVersion_propertyDocumentId_fkey"
  FOREIGN KEY ("propertyDocumentId") REFERENCES "PropertyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyObjectAIAnalysis"
  ADD CONSTRAINT "PropertyObjectAIAnalysis_propertyObjectId_fkey"
  FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyObjectAIAnalysis"
  ADD CONSTRAINT "PropertyObjectAIAnalysis_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyObjectAIAnalysis"
  ADD CONSTRAINT "PropertyObjectAIAnalysis_officeId_fkey"
  FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyObjectAIFieldProposal"
  ADD CONSTRAINT "PropertyObjectAIFieldProposal_analysisId_fkey"
  FOREIGN KEY ("analysisId") REFERENCES "PropertyObjectAIAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyObjectAIFieldProposal"
  ADD CONSTRAINT "PropertyObjectAIFieldProposal_propertyObjectId_fkey"
  FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyObjectAIFieldProposal"
  ADD CONSTRAINT "PropertyObjectAIFieldProposal_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyObjectAIFieldProposal"
  ADD CONSTRAINT "PropertyObjectAIFieldProposal_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
