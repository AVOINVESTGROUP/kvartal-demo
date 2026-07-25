-- CreateEnum
CREATE TYPE "PropertyIdentitySubjectScope" AS ENUM ('PROJECT', 'LAND_PARCEL', 'BUILDING', 'PREMISE', 'UNIT');

-- CreateEnum
CREATE TYPE "PropertyRegistrationStatus" AS ENUM ('DRAFT', 'READY_FOR_CHECK', 'CHECKING', 'NEEDS_CORRECTION', 'UNIQUE_CANDIDATE', 'EXACT_EXISTING', 'PROBABLE_DUPLICATE', 'STRONG_IDENTIFIER_CONFLICT', 'CONFIRMING', 'CANONICAL_CREATED', 'LINKED_EXISTING', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PropertyIdentityCheckRunStatus" AS ENUM ('PENDING', 'RUNNING', 'RESOLVED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PropertyIdentityCheckOutcome" AS ENUM ('EXACT_EXISTING', 'UNIQUE_CANDIDATE', 'PROBABLE_DUPLICATE', 'INSUFFICIENT_EVIDENCE', 'DIFFERENT_SUBJECT_SCOPE', 'DIFFERENT_UNIT_SAME_PROJECT', 'STRONG_IDENTIFIER_CONFLICT');

-- CreateEnum
CREATE TYPE "PropertyIdentifierObservationStatus" AS ENUM ('DRAFT', 'READY', 'NEEDS_CORRECTION', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PropertyIdentifierClaimStatus" AS ENUM ('ACTIVE', 'REVOKED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PropertyIdentityStatus" AS ENUM ('PROVISIONAL', 'VERIFIED_INTERNAL', 'SUSPENDED', 'REVOKED', 'MERGED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PropertyIdentityAuthorResolution" AS ENUM ('CREATE_NEW', 'LINK_EXISTING');

-- CreateEnum
CREATE TYPE "PropertyIdentityPolicyScope" AS ENUM ('GLOBAL', 'MARKET', 'ORGANISATION');

-- CreateEnum
CREATE TYPE "PropertyIdentityRolloutMode" AS ENUM ('DISABLED', 'NEW_SUBMISSIONS_ONLY', 'STRICT');

-- CreateEnum
CREATE TYPE "PropertyIdentityJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PropertyIdentityCryptoKeyStatus" AS ENUM ('ACTIVE', 'RETIRING', 'RETIRED');

-- CreateTable
CREATE TABLE "PropertyRegistrationSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "intakeSubmissionId" TEXT,
    "aiDraftId" TEXT,
    "canonicalPropertyObjectId" TEXT,
    "subjectScope" "PropertyIdentitySubjectScope" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "status" "PropertyRegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "identityInput" JSONB NOT NULL,
    "lastIdentityInputHash" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyRegistrationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentifierObservation" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "subjectScope" "PropertyIdentitySubjectScope" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "authorityNamespace" TEXT NOT NULL,
    "rawValueCiphertext" BYTEA NOT NULL,
    "rawValueNonce" BYTEA NOT NULL,
    "rawValueAuthTag" BYTEA NOT NULL,
    "normalizedValueCiphertext" BYTEA NOT NULL,
    "normalizedValueNonce" BYTEA NOT NULL,
    "normalizedValueAuthTag" BYTEA NOT NULL,
    "normalizerId" TEXT NOT NULL,
    "normalizerVersion" INTEGER NOT NULL,
    "structuredComponents" JSONB,
    "sourceType" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceUrl" TEXT,
    "status" "PropertyIdentifierObservationStatus" NOT NULL DEFAULT 'DRAFT',
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIdentifierObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentifierObservationDigest" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "digestKeyVersion" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyIdentifierObservationDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityCheckRun" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "status" "PropertyIdentityCheckRunStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "PropertyIdentityCheckOutcome",
    "identityInputHash" TEXT NOT NULL,
    "authorityPolicyVersion" INTEGER NOT NULL,
    "redactedResult" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIdentityCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityCandidateEvidence" (
    "id" TEXT NOT NULL,
    "checkRunId" TEXT NOT NULL,
    "candidateProfileId" TEXT,
    "evidenceType" TEXT NOT NULL,
    "signalCode" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "redactedDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyIdentityCandidateEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityProfile" (
    "id" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "createdFromSubmissionId" TEXT,
    "subjectScope" "PropertyIdentitySubjectScope" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "status" "PropertyIdentityStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIdentityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentifierClaim" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "originObservationId" TEXT,
    "scheme" TEXT NOT NULL,
    "subjectScope" "PropertyIdentitySubjectScope" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "authorityNamespace" TEXT NOT NULL,
    "normalizedValueCiphertext" BYTEA NOT NULL,
    "normalizedValueNonce" BYTEA NOT NULL,
    "normalizedValueAuthTag" BYTEA NOT NULL,
    "normalizerId" TEXT NOT NULL,
    "normalizerVersion" INTEGER NOT NULL,
    "status" "PropertyIdentifierClaimStatus" NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIdentifierClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentifierClaimDigest" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "digestKeyVersion" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyIdentifierClaimDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyCanonicalVersion" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshotJson" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "authorConfirmationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "PropertyCanonicalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityAuthorConfirmation" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "checkRunId" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "confirmedByUserId" TEXT NOT NULL,
    "resolution" "PropertyIdentityAuthorResolution" NOT NULL,
    "identityInputHash" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyIdentityAuthorConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityAuthorityPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "marketId" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "assetClass" "AssetClass",
    "subjectScope" "PropertyIdentitySubjectScope" NOT NULL,
    "identifierScheme" TEXT NOT NULL,
    "authorityNamespacePattern" TEXT NOT NULL,
    "normalizerId" TEXT NOT NULL,
    "normalizerVersion" INTEGER NOT NULL,
    "automaticExactMatchAllowed" BOOLEAN NOT NULL DEFAULT true,
    "requiredEvidenceType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "configuredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIdentityAuthorityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityRolloutPolicy" (
    "id" TEXT NOT NULL,
    "scope" "PropertyIdentityPolicyScope" NOT NULL,
    "organizationId" TEXT,
    "marketId" TEXT,
    "mode" "PropertyIdentityRolloutMode" NOT NULL DEFAULT 'DISABLED',
    "registryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishGateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "activationAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "configuredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIdentityRolloutPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityEvent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT,
    "identityProfileId" TEXT,
    "actorUserId" TEXT,
    "actorOrganizationId" TEXT,
    "actorOfficeId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "reasonCode" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyIdentityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityJob" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "PropertyIdentityJobStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyIdentityJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityCryptoKeyVersion" (
    "version" TEXT NOT NULL,
    "status" "PropertyIdentityCryptoKeyStatus" NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL,
    "retiringAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyIdentityCryptoKeyVersion_pkey" PRIMARY KEY ("version")
);

-- CreateIndex
CREATE INDEX "PropertyRegistrationSubmission_organizationId_status_update_idx" ON "PropertyRegistrationSubmission"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PropertyRegistrationSubmission_officeId_status_updatedAt_idx" ON "PropertyRegistrationSubmission"("officeId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PropertyRegistrationSubmission_marketId_status_updatedAt_idx" ON "PropertyRegistrationSubmission"("marketId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PropertyRegistrationSubmission_createdByUserId_status_updat_idx" ON "PropertyRegistrationSubmission"("createdByUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PropertyRegistrationSubmission_canonicalPropertyObjectId_idx" ON "PropertyRegistrationSubmission"("canonicalPropertyObjectId");

-- CreateIndex
CREATE INDEX "PropertyIdentifierObservation_submissionId_status_idx" ON "PropertyIdentifierObservation"("submissionId", "status");

-- CreateIndex
CREATE INDEX "PropertyIdentifierObservation_scheme_jurisdiction_authority_idx" ON "PropertyIdentifierObservation"("scheme", "jurisdiction", "authorityNamespace", "subjectScope");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentifierObservationDigest_observationId_digestKeyVersion_key" ON "PropertyIdentifierObservationDigest"("observationId", "digestKeyVersion");

-- CreateIndex
CREATE INDEX "PropertyIdentifierObservationDigest_digestKeyVersion_digest_idx" ON "PropertyIdentifierObservationDigest"("digestKeyVersion", "digest");

-- CreateIndex
CREATE INDEX "PropertyIdentityCheckRun_submissionId_createdAt_idx" ON "PropertyIdentityCheckRun"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyIdentityCheckRun_status_createdAt_idx" ON "PropertyIdentityCheckRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyIdentityCandidateEvidence_checkRunId_evidenceType_idx" ON "PropertyIdentityCandidateEvidence"("checkRunId", "evidenceType");

-- CreateIndex
CREATE INDEX "PropertyIdentityCandidateEvidence_candidateProfileId_idx" ON "PropertyIdentityCandidateEvidence"("candidateProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentityProfile_stableId_key" ON "PropertyIdentityProfile"("stableId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentityProfile_propertyObjectId_key" ON "PropertyIdentityProfile"("propertyObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentityProfile_createdFromSubmissionId_key" ON "PropertyIdentityProfile"("createdFromSubmissionId");

-- CreateIndex
CREATE INDEX "PropertyIdentityProfile_status_jurisdiction_subjectScope_idx" ON "PropertyIdentityProfile"("status", "jurisdiction", "subjectScope");

-- CreateIndex
CREATE INDEX "PropertyIdentifierClaim_identityProfileId_status_idx" ON "PropertyIdentifierClaim"("identityProfileId", "status");

-- CreateIndex
CREATE INDEX "PropertyIdentifierClaim_scheme_jurisdiction_authorityNamesp_idx" ON "PropertyIdentifierClaim"("scheme", "jurisdiction", "authorityNamespace", "subjectScope", "status");

-- CreateIndex
CREATE INDEX "PropertyIdentifierClaimDigest_digestKeyVersion_digest_idx" ON "PropertyIdentifierClaimDigest"("digestKeyVersion", "digest");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentifierClaimDigest_claimId_digestKeyVersion_key" ON "PropertyIdentifierClaimDigest"("claimId", "digestKeyVersion");

-- One active namespaced digest can resolve to only one canonical claim.
CREATE UNIQUE INDEX "PropertyIdentifierClaimDigest_active_digest_key" ON "PropertyIdentifierClaimDigest"("digestKeyVersion", "digest") WHERE "active" = true;

-- CreateIndex
CREATE INDEX "PropertyCanonicalVersion_identityProfileId_isCurrent_idx" ON "PropertyCanonicalVersion"("identityProfileId", "isCurrent");

-- CreateIndex
CREATE INDEX "PropertyCanonicalVersion_snapshotHash_idx" ON "PropertyCanonicalVersion"("snapshotHash");

-- A profile has exactly one current canonical snapshot once versioning begins.
CREATE UNIQUE INDEX "PropertyCanonicalVersion_one_current_per_profile" ON "PropertyCanonicalVersion"("identityProfileId") WHERE "isCurrent" = true;

-- CreateIndex
CREATE UNIQUE INDEX "PropertyCanonicalVersion_identityProfileId_versionNumber_key" ON "PropertyCanonicalVersion"("identityProfileId", "versionNumber");

-- CreateIndex
CREATE INDEX "PropertyIdentityAuthorConfirmation_identityProfileId_create_idx" ON "PropertyIdentityAuthorConfirmation"("identityProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyIdentityAuthorConfirmation_confirmedByUserId_create_idx" ON "PropertyIdentityAuthorConfirmation"("confirmedByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentityAuthorConfirmation_submissionId_key" ON "PropertyIdentityAuthorConfirmation"("submissionId");

-- CreateIndex
CREATE INDEX "PropertyIdentityAuthorityPolicy_jurisdiction_subjectScope_i_idx" ON "PropertyIdentityAuthorityPolicy"("jurisdiction", "subjectScope", "identifierScheme", "active");

-- CreateIndex
CREATE INDEX "PropertyIdentityAuthorityPolicy_organizationId_active_idx" ON "PropertyIdentityAuthorityPolicy"("organizationId", "active");

-- CreateIndex
CREATE INDEX "PropertyIdentityAuthorityPolicy_marketId_active_idx" ON "PropertyIdentityAuthorityPolicy"("marketId", "active");

-- CreateIndex
CREATE INDEX "PropertyIdentityRolloutPolicy_scope_organizationId_marketId_idx" ON "PropertyIdentityRolloutPolicy"("scope", "organizationId", "marketId");

-- CreateIndex
CREATE INDEX "PropertyIdentityEvent_submissionId_createdAt_idx" ON "PropertyIdentityEvent"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyIdentityEvent_identityProfileId_createdAt_idx" ON "PropertyIdentityEvent"("identityProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyIdentityEvent_actorOrganizationId_createdAt_idx" ON "PropertyIdentityEvent"("actorOrganizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentityJob_idempotencyKey_key" ON "PropertyIdentityJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PropertyIdentityJob_status_runAfter_idx" ON "PropertyIdentityJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "PropertyIdentityJob_submissionId_createdAt_idx" ON "PropertyIdentityJob"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyIdentityCryptoKeyVersion_status_activatedAt_idx" ON "PropertyIdentityCryptoKeyVersion"("status", "activatedAt");

-- AddForeignKey
ALTER TABLE "PropertyRegistrationSubmission" ADD CONSTRAINT "PropertyRegistrationSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRegistrationSubmission" ADD CONSTRAINT "PropertyRegistrationSubmission_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRegistrationSubmission" ADD CONSTRAINT "PropertyRegistrationSubmission_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRegistrationSubmission" ADD CONSTRAINT "PropertyRegistrationSubmission_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRegistrationSubmission" ADD CONSTRAINT "PropertyRegistrationSubmission_intakeSubmissionId_fkey" FOREIGN KEY ("intakeSubmissionId") REFERENCES "PropertyIntakeSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRegistrationSubmission" ADD CONSTRAINT "PropertyRegistrationSubmission_aiDraftId_fkey" FOREIGN KEY ("aiDraftId") REFERENCES "PropertyAIDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRegistrationSubmission" ADD CONSTRAINT "PropertyRegistrationSubmission_canonicalPropertyObjectId_fkey" FOREIGN KEY ("canonicalPropertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentifierObservation" ADD CONSTRAINT "PropertyIdentifierObservation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PropertyRegistrationSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentifierObservation" ADD CONSTRAINT "PropertyIdentifierObservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentifierObservationDigest" ADD CONSTRAINT "PropertyIdentifierObservationDigest_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "PropertyIdentifierObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentifierObservationDigest" ADD CONSTRAINT "PropertyIdentifierObservationDigest_digestKeyVersion_fkey" FOREIGN KEY ("digestKeyVersion") REFERENCES "PropertyIdentityCryptoKeyVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityCheckRun" ADD CONSTRAINT "PropertyIdentityCheckRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PropertyRegistrationSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityCandidateEvidence" ADD CONSTRAINT "PropertyIdentityCandidateEvidence_checkRunId_fkey" FOREIGN KEY ("checkRunId") REFERENCES "PropertyIdentityCheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityCandidateEvidence" ADD CONSTRAINT "PropertyIdentityCandidateEvidence_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityProfile" ADD CONSTRAINT "PropertyIdentityProfile_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityProfile" ADD CONSTRAINT "PropertyIdentityProfile_createdFromSubmissionId_fkey" FOREIGN KEY ("createdFromSubmissionId") REFERENCES "PropertyRegistrationSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentifierClaim" ADD CONSTRAINT "PropertyIdentifierClaim_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentifierClaim" ADD CONSTRAINT "PropertyIdentifierClaim_originObservationId_fkey" FOREIGN KEY ("originObservationId") REFERENCES "PropertyIdentifierObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentifierClaimDigest" ADD CONSTRAINT "PropertyIdentifierClaimDigest_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "PropertyIdentifierClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentifierClaimDigest" ADD CONSTRAINT "PropertyIdentifierClaimDigest_digestKeyVersion_fkey" FOREIGN KEY ("digestKeyVersion") REFERENCES "PropertyIdentityCryptoKeyVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCanonicalVersion" ADD CONSTRAINT "PropertyCanonicalVersion_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCanonicalVersion" ADD CONSTRAINT "PropertyCanonicalVersion_authorConfirmationId_fkey" FOREIGN KEY ("authorConfirmationId") REFERENCES "PropertyIdentityAuthorConfirmation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCanonicalVersion" ADD CONSTRAINT "PropertyCanonicalVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityAuthorConfirmation" ADD CONSTRAINT "PropertyIdentityAuthorConfirmation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PropertyRegistrationSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityAuthorConfirmation" ADD CONSTRAINT "PropertyIdentityAuthorConfirmation_checkRunId_fkey" FOREIGN KEY ("checkRunId") REFERENCES "PropertyIdentityCheckRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityAuthorConfirmation" ADD CONSTRAINT "PropertyIdentityAuthorConfirmation_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityAuthorConfirmation" ADD CONSTRAINT "PropertyIdentityAuthorConfirmation_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityAuthorityPolicy" ADD CONSTRAINT "PropertyIdentityAuthorityPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityAuthorityPolicy" ADD CONSTRAINT "PropertyIdentityAuthorityPolicy_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityRolloutPolicy" ADD CONSTRAINT "PropertyIdentityRolloutPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityRolloutPolicy" ADD CONSTRAINT "PropertyIdentityRolloutPolicy_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityEvent" ADD CONSTRAINT "PropertyIdentityEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PropertyRegistrationSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityEvent" ADD CONSTRAINT "PropertyIdentityEvent_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityEvent" ADD CONSTRAINT "PropertyIdentityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityJob" ADD CONSTRAINT "PropertyIdentityJob_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PropertyRegistrationSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database invariants not expressible in Prisma schema.
ALTER TABLE "PropertyRegistrationSubmission" ADD CONSTRAINT "PropertyRegistrationSubmission_rowVersion_positive" CHECK ("rowVersion" > 0);
ALTER TABLE "PropertyIdentifierObservation" ADD CONSTRAINT "PropertyIdentifierObservation_cipher_shapes" CHECK (
  octet_length("rawValueNonce") = 12 AND octet_length("rawValueAuthTag") = 16 AND
  octet_length("normalizedValueNonce") = 12 AND octet_length("normalizedValueAuthTag") = 16
);
ALTER TABLE "PropertyIdentifierClaim" ADD CONSTRAINT "PropertyIdentifierClaim_cipher_shapes" CHECK (
  octet_length("normalizedValueNonce") = 12 AND octet_length("normalizedValueAuthTag") = 16
);
ALTER TABLE "PropertyIdentityProfile" ADD CONSTRAINT "PropertyIdentityProfile_currentVersion_positive" CHECK ("currentVersionNumber" > 0);
ALTER TABLE "PropertyCanonicalVersion" ADD CONSTRAINT "PropertyCanonicalVersion_versions_positive" CHECK ("versionNumber" > 0 AND "snapshotSchemaVersion" > 0);
ALTER TABLE "PropertyIdentityCheckRun" ADD CONSTRAINT "PropertyIdentityCheckRun_attempts_nonnegative" CHECK ("attemptCount" >= 0);
ALTER TABLE "PropertyIdentityJob" ADD CONSTRAINT "PropertyIdentityJob_attempt_bounds" CHECK ("attemptCount" >= 0 AND "maxAttempts" > 0 AND "attemptCount" <= "maxAttempts");
ALTER TABLE "PropertyIdentityAuthorityPolicy" ADD CONSTRAINT "PropertyIdentityAuthorityPolicy_effective_range" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom");
ALTER TABLE "PropertyIdentityRolloutPolicy" ADD CONSTRAINT "PropertyIdentityRolloutPolicy_scope_fields" CHECK (
  ("scope" = 'GLOBAL' AND "organizationId" IS NULL AND "marketId" IS NULL) OR
  ("scope" = 'MARKET' AND "organizationId" IS NULL AND "marketId" IS NOT NULL) OR
  ("scope" = 'ORGANISATION' AND "organizationId" IS NOT NULL AND "marketId" IS NULL)
);
