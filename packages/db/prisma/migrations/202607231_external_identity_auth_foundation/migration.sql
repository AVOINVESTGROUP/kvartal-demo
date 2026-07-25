CREATE TYPE "ExternalIdentityProvider" AS ENUM ('FIREBASE');
CREATE TYPE "ExternalIdentityStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "ExternalIdentityBindingRequestType" AS ENUM ('BIND', 'REACTIVATE');
CREATE TYPE "ExternalIdentityBindingRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ExternalIdentityBindingEventType" AS ENUM ('REQUESTED', 'CANDIDATE_SELECTED', 'CANDIDATE_USER_CREATED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'IDENTITY_REVOKED', 'REACTIVATION_REQUESTED', 'IDENTITY_REACTIVATED', 'LOGIN_BLOCKED', 'ACTION_DENIED', 'BOOTSTRAP_COMPLETED');
CREATE TYPE "ExternalIdentityAuditActorType" AS ENUM ('USER', 'SYSTEM_SERVICE', 'BOOTSTRAP_SYSTEM');
CREATE TYPE "ExternalIdentityBootstrapStatus" AS ENUM ('AVAILABLE', 'COMPLETED', 'DISABLED');
CREATE TYPE "MutationIdempotencyStatus" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_FINAL');

CREATE TABLE "AppUserExternalIdentity" (
  "id" TEXT NOT NULL,
  "appUserId" TEXT NOT NULL,
  "provider" "ExternalIdentityProvider" NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "ExternalIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
  "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "boundByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "revocationReason" TEXT,
  "reactivatedAt" TIMESTAMP(3),
  "reactivatedByUserId" TEXT,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppUserExternalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalIdentityBindingRequest" (
  "id" TEXT NOT NULL,
  "requestType" "ExternalIdentityBindingRequestType" NOT NULL,
  "provider" "ExternalIdentityProvider" NOT NULL,
  "subject" TEXT NOT NULL,
  "subjectDigest" TEXT NOT NULL,
  "verifiedEmail" TEXT,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "candidateAppUserId" TEXT,
  "targetExternalIdentityId" TEXT,
  "requestedByProvider" "ExternalIdentityProvider" NOT NULL,
  "requestedBySubject" TEXT NOT NULL,
  "requestedBySubjectDigest" TEXT NOT NULL,
  "requestedByAppUserId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "ExternalIdentityBindingRequestStatus" NOT NULL DEFAULT 'PENDING',
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "reviewedByUserId" TEXT,
  "reviewedBySubject" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reason" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalIdentityBindingRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalIdentityBindingEvent" (
  "id" TEXT NOT NULL,
  "eventType" "ExternalIdentityBindingEventType" NOT NULL,
  "requestId" TEXT,
  "externalIdentityId" TEXT,
  "actorType" "ExternalIdentityAuditActorType" NOT NULL,
  "actorAppUserId" TEXT,
  "actorProvider" "ExternalIdentityProvider",
  "actorSubjectDigest" TEXT,
  "previousStatus" TEXT,
  "nextStatus" TEXT,
  "reasonCode" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalIdentityBindingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalIdentityBootstrapState" (
  "key" TEXT NOT NULL,
  "status" "ExternalIdentityBootstrapStatus" NOT NULL DEFAULT 'AVAILABLE',
  "targetAppUserId" TEXT,
  "externalIdentityId" TEXT,
  "completedAt" TIMESTAMP(3),
  "auditEventId" TEXT,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalIdentityBootstrapState_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "MutationIdempotency" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "MutationIdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "responseHeaders" JSONB,
  "terminalAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MutationIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppUserExternalIdentity_provider_subject_key" ON "AppUserExternalIdentity"("provider", "subject");
CREATE UNIQUE INDEX "AppUserExternalIdentity_one_active_firebase_per_user" ON "AppUserExternalIdentity"("appUserId") WHERE "provider" = 'FIREBASE' AND "status" = 'ACTIVE';
CREATE INDEX "AppUserExternalIdentity_appUserId_status_idx" ON "AppUserExternalIdentity"("appUserId", "status");
CREATE INDEX "AppUserExternalIdentity_updatedAt_id_idx" ON "AppUserExternalIdentity"("updatedAt", "id");
CREATE UNIQUE INDEX "ExternalIdentityBindingRequest_one_pending_subject" ON "ExternalIdentityBindingRequest"("requestType", "provider", "subject") WHERE "status" = 'PENDING';
CREATE INDEX "ExternalIdentityBindingRequest_requestedAt_id_idx" ON "ExternalIdentityBindingRequest"("requestedAt", "id");
CREATE INDEX "ExternalIdentityBindingRequest_expiresAt_status_idx" ON "ExternalIdentityBindingRequest"("expiresAt", "status");
CREATE INDEX "ExternalIdentityBindingEvent_requestId_createdAt_idx" ON "ExternalIdentityBindingEvent"("requestId", "createdAt");
CREATE INDEX "ExternalIdentityBindingEvent_externalIdentityId_createdAt_idx" ON "ExternalIdentityBindingEvent"("externalIdentityId", "createdAt");
CREATE INDEX "ExternalIdentityBindingEvent_createdAt_idx" ON "ExternalIdentityBindingEvent"("createdAt");
CREATE UNIQUE INDEX "MutationIdempotency_scope_key" ON "MutationIdempotency"("scope");
CREATE INDEX "MutationIdempotency_status_terminalAt_idx" ON "MutationIdempotency"("status", "terminalAt");

ALTER TABLE "AppUserExternalIdentity" ADD CONSTRAINT "AppUserExternalIdentity_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppUserExternalIdentity" ADD CONSTRAINT "AppUserExternalIdentity_boundByUserId_fkey" FOREIGN KEY ("boundByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppUserExternalIdentity" ADD CONSTRAINT "AppUserExternalIdentity_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppUserExternalIdentity" ADD CONSTRAINT "AppUserExternalIdentity_reactivatedByUserId_fkey" FOREIGN KEY ("reactivatedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBindingRequest" ADD CONSTRAINT "ExternalIdentityBindingRequest_candidateAppUserId_fkey" FOREIGN KEY ("candidateAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBindingRequest" ADD CONSTRAINT "ExternalIdentityBindingRequest_targetExternalIdentityId_fkey" FOREIGN KEY ("targetExternalIdentityId") REFERENCES "AppUserExternalIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBindingRequest" ADD CONSTRAINT "ExternalIdentityBindingRequest_requestedByAppUserId_fkey" FOREIGN KEY ("requestedByAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBindingRequest" ADD CONSTRAINT "ExternalIdentityBindingRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBindingEvent" ADD CONSTRAINT "ExternalIdentityBindingEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExternalIdentityBindingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBindingEvent" ADD CONSTRAINT "ExternalIdentityBindingEvent_externalIdentityId_fkey" FOREIGN KEY ("externalIdentityId") REFERENCES "AppUserExternalIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBindingEvent" ADD CONSTRAINT "ExternalIdentityBindingEvent_actorAppUserId_fkey" FOREIGN KEY ("actorAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBootstrapState" ADD CONSTRAINT "ExternalIdentityBootstrapState_targetAppUserId_fkey" FOREIGN KEY ("targetAppUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalIdentityBootstrapState" ADD CONSTRAINT "ExternalIdentityBootstrapState_externalIdentityId_fkey" FOREIGN KEY ("externalIdentityId") REFERENCES "AppUserExternalIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
