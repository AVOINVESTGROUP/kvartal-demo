-- Property Identity v4 correction: one platform owner, agency wallet attestations,
-- one token with many representations, and offer-bound request/deal routing.

BEGIN;

-- The product has exactly one active platform owner. Organization and office
-- memberships of the other users are deliberately preserved.
UPDATE "PlatformRoleAssignment" AS role
SET "active" = false
FROM "AppUser" AS app_user
WHERE role."userId" = app_user."id"
  AND role."role" = 'platform_owner'
  AND app_user."email" <> 'office@integrayachtsuae.com';

CREATE UNIQUE INDEX "PlatformRoleAssignment_single_active_owner"
ON "PlatformRoleAssignment" ("role")
WHERE "role" = 'platform_owner' AND "active" = true;

ALTER TABLE "OrganizationCorporateWallet"
  ADD COLUMN "walletType" TEXT NOT NULL DEFAULT 'EOA',
  ADD COLUMN "challengeUserId" TEXT,
  ADD COLUMN "verifiedByUserId" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "OrganizationCorporateWallet_one_active_address_per_chain"
ON "OrganizationCorporateWallet" ("chainId", lower("walletAddress"))
WHERE "status" IN ('VERIFIED', 'ACTIVE');

ALTER TABLE "OrganizationCorporateWallet"
  ADD CONSTRAINT "OrganizationCorporateWallet_challengeUserId_fkey"
  FOREIGN KEY ("challengeUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "OrganizationCorporateWallet_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PropertyRepresentationRight"
  ADD COLUMN "corporateWalletId" TEXT,
  ADD COLUMN "evidenceHash" TEXT,
  ADD COLUMN "attestedAt" TIMESTAMP(3),
  ADD COLUMN "auditedByUserId" TEXT,
  ADD COLUMN "auditedAt" TIMESTAMP(3),
  ADD COLUMN "auditReason" TEXT;

CREATE INDEX "PropertyRepresentationRight_corporateWalletId_status_idx"
ON "PropertyRepresentationRight" ("corporateWalletId", "status");

CREATE UNIQUE INDEX "PropertyRepresentationRight_one_live_agency_right"
ON "PropertyRepresentationRight" ("propertyObjectId", "organizationId", "rightType")
WHERE "status" IN ('ATTESTED', 'VERIFIED');

ALTER TABLE "PropertyRepresentationRight"
  ADD CONSTRAINT "PropertyRepresentationRight_corporateWalletId_fkey"
  FOREIGN KEY ("corporateWalletId") REFERENCES "OrganizationCorporateWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PropertyRepresentationRight_declaredByUserId_fkey"
  FOREIGN KEY ("declaredByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PropertyRepresentationRight_auditedByUserId_fkey"
  FOREIGN KEY ("auditedByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RepresentationEvidenceDocument" (
  "representationRightId" TEXT NOT NULL,
  "propertyDocumentId" TEXT NOT NULL,
  "attachedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepresentationEvidenceDocument_pkey" PRIMARY KEY ("representationRightId", "propertyDocumentId"),
  CONSTRAINT "RepresentationEvidenceDocument_representationRightId_fkey" FOREIGN KEY ("representationRightId") REFERENCES "PropertyRepresentationRight"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RepresentationEvidenceDocument_propertyDocumentId_fkey" FOREIGN KEY ("propertyDocumentId") REFERENCES "PropertyDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "RepresentationEvidenceDocument_propertyDocumentId_idx"
ON "RepresentationEvidenceDocument" ("propertyDocumentId");

ALTER TABLE "PartnerOffer" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "PartnerOffer"
  ADD CONSTRAINT "PartnerOffer_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PartnerOffer_representationRightId_status_idx" ON "PartnerOffer" ("representationRightId", "status");
CREATE UNIQUE INDEX "PartnerOffer_one_active_per_representation"
ON "PartnerOffer" ("representationRightId") WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "PropertyPublicationGrant_one_active_per_offer_surface"
ON "PropertyPublicationGrant" ("partnerOfferId", "publicationSurfaceId") WHERE "status" = 'ACTIVE';

ALTER TABLE "PartnerInteraction"
  ADD COLUMN "partnerOfferId" TEXT,
  ADD COLUMN "representationRightId" TEXT,
  ADD COLUMN "publicationGrantId" TEXT,
  ADD COLUMN "clientIntentId" TEXT;

ALTER TABLE "PartnerInteraction"
  ADD CONSTRAINT "PartnerInteraction_partnerOfferId_fkey" FOREIGN KEY ("partnerOfferId") REFERENCES "PartnerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PartnerInteraction_representationRightId_fkey" FOREIGN KEY ("representationRightId") REFERENCES "PropertyRepresentationRight"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PartnerInteraction_publicationGrantId_fkey" FOREIGN KEY ("publicationGrantId") REFERENCES "PropertyPublicationGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PartnerInteraction_clientIntentId_fkey" FOREIGN KEY ("clientIntentId") REFERENCES "ClientIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PartnerInteraction_partnerOfferId_status_updatedAt_idx" ON "PartnerInteraction" ("partnerOfferId", "status", "updatedAt");
CREATE INDEX "PartnerInteraction_clientIntentId_idx" ON "PartnerInteraction" ("clientIntentId");

ALTER TABLE "DealRoom"
  ADD COLUMN "partnerInteractionId" TEXT,
  ADD COLUMN "partnerOfferId" TEXT,
  ADD COLUMN "representationRightId" TEXT,
  ADD COLUMN "publicationGrantId" TEXT;

CREATE UNIQUE INDEX "DealRoom_partnerInteractionId_key" ON "DealRoom" ("partnerInteractionId");
ALTER TABLE "DealRoom"
  ADD CONSTRAINT "DealRoom_partnerInteractionId_fkey" FOREIGN KEY ("partnerInteractionId") REFERENCES "PartnerInteraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DealRoom_partnerOfferId_fkey" FOREIGN KEY ("partnerOfferId") REFERENCES "PartnerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DealRoom_representationRightId_fkey" FOREIGN KEY ("representationRightId") REFERENCES "PropertyRepresentationRight"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DealRoom_publicationGrantId_fkey" FOREIGN KEY ("publicationGrantId") REFERENCES "PropertyPublicationGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PlatformRegistryWallet" (
  "id" TEXT NOT NULL,
  "platformOwnerUserId" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "secretResourceName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "boundByUserId" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformRegistryWallet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformRegistryWallet_platformOwnerUserId_fkey" FOREIGN KEY ("platformOwnerUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlatformRegistryWallet_boundByUserId_fkey" FOREIGN KEY ("boundByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlatformRegistryWallet_chainId_walletAddress_key" ON "PlatformRegistryWallet" ("chainId", "walletAddress");
CREATE UNIQUE INDEX "PlatformRegistryWallet_platformOwnerUserId_chainId_key" ON "PlatformRegistryWallet" ("platformOwnerUserId", "chainId");

ALTER TABLE "BlockchainContractRegistry" ADD COLUMN "platformRegistryWalletId" TEXT;
ALTER TABLE "BlockchainContractRegistry"
  ADD CONSTRAINT "BlockchainContractRegistry_platformRegistryWalletId_fkey" FOREIGN KEY ("platformRegistryWalletId") REFERENCES "PlatformRegistryWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PropertyIdentityToken" ADD COLUMN "platformRegistryWalletId" TEXT;
ALTER TABLE "PropertyIdentityToken" ALTER COLUMN "ownerWalletId" DROP NOT NULL;
ALTER TABLE "PropertyIdentityToken"
  ADD CONSTRAINT "PropertyIdentityToken_platformRegistryWalletId_fkey" FOREIGN KEY ("platformRegistryWalletId") REFERENCES "PlatformRegistryWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PropertyTokenRepresentation" (
  "id" TEXT NOT NULL,
  "tokenRecordId" TEXT NOT NULL,
  "identityProfileId" TEXT NOT NULL,
  "representationRightId" TEXT NOT NULL,
  "corporateWalletId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "lastTxHash" TEXT,
  "lastLogIndex" INTEGER,
  "lastReconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyTokenRepresentation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyTokenRepresentation_tokenRecordId_fkey" FOREIGN KEY ("tokenRecordId") REFERENCES "PropertyIdentityToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropertyTokenRepresentation_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropertyTokenRepresentation_representationRightId_fkey" FOREIGN KEY ("representationRightId") REFERENCES "PropertyRepresentationRight"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropertyTokenRepresentation_corporateWalletId_fkey" FOREIGN KEY ("corporateWalletId") REFERENCES "OrganizationCorporateWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PropertyTokenRepresentation_tokenRecordId_representationRightId_key" ON "PropertyTokenRepresentation" ("tokenRecordId", "representationRightId");
CREATE INDEX "PropertyTokenRepresentation_corporateWalletId_status_idx" ON "PropertyTokenRepresentation" ("corporateWalletId", "status");

COMMIT;
CREATE INDEX "PropertyTokenRepresentation_walletAddress_status_idx" ON "PropertyTokenRepresentation" ("walletAddress", "status");
