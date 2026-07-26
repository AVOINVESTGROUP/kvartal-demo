-- One physical property has one identity. Partner-specific rights, offers and
-- publication grants attach to that canonical property instead of duplicating it.

CREATE TYPE "PropertyOriginatorStatus" AS ENUM ('RECORDED', 'REVOKED');
CREATE TYPE "PropertyRepresentationStatus" AS ENUM ('DECLARED', 'EVIDENCE_PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED', 'DISPUTED');
CREATE TYPE "PropertyOfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'WITHDRAWN');
CREATE TYPE "PublicationSurfaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "PropertyPublicationGrantStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REPLACED', 'EXPIRED', 'REVOKED', 'SUSPENDED');

CREATE TABLE "PropertyOriginatorRecord" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "status" "PropertyOriginatorStatus" NOT NULL DEFAULT 'RECORDED',
    "recordedByUserId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyOriginatorRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyRepresentationRight" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "rightType" TEXT NOT NULL,
    "status" "PropertyRepresentationStatus" NOT NULL DEFAULT 'DECLARED',
    "scope" JSONB NOT NULL,
    "territory" TEXT,
    "channel" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "evidenceDocumentIds" TEXT[] NOT NULL,
    "declaredByUserId" TEXT NOT NULL,
    "verifiedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyRepresentationRight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerOffer" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "representationRightId" TEXT NOT NULL,
    "sellerOrganizationId" TEXT NOT NULL,
    "sellerOfficeId" TEXT NOT NULL,
    "status" "PropertyOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "priceAmount" DECIMAL(18,2),
    "priceCurrency" "CurrencyCode",
    "paymentTerms" JSONB,
    "availability" TEXT,
    "commercialTerms" JSONB,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "sourceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyPublicationSurface" (
    "id" TEXT NOT NULL,
    "siteConfigId" TEXT,
    "tenantKey" TEXT,
    "canonicalHost" TEXT,
    "surfaceType" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "status" "PublicationSurfaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyPublicationSurface_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PropertyPublicationSurface_target_check" CHECK (("siteConfigId" IS NOT NULL) <> ("tenantKey" IS NOT NULL))
);

CREATE TABLE "PropertyPublicationGrant" (
    "id" TEXT NOT NULL,
    "publicationSurfaceId" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "partnerOfferId" TEXT NOT NULL,
    "canonicalVersionId" TEXT NOT NULL,
    "buyerSideOrganizationId" TEXT NOT NULL,
    "buyerSideOfficeId" TEXT NOT NULL,
    "sellerSideOrganizationId" TEXT NOT NULL,
    "sellerSideOfficeId" TEXT NOT NULL,
    "status" "PropertyPublicationGrantStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "replacedByGrantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyPublicationGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropertyOriginatorRecord_identityProfileId_organizationId_officeId_key" ON "PropertyOriginatorRecord"("identityProfileId", "organizationId", "officeId");
CREATE INDEX "PropertyOriginatorRecord_identityProfileId_status_idx" ON "PropertyOriginatorRecord"("identityProfileId", "status");
CREATE INDEX "PropertyOriginatorRecord_organizationId_status_idx" ON "PropertyOriginatorRecord"("organizationId", "status");
CREATE INDEX "PropertyRepresentationRight_propertyObjectId_status_idx" ON "PropertyRepresentationRight"("propertyObjectId", "status");
CREATE INDEX "PropertyRepresentationRight_identityProfileId_status_idx" ON "PropertyRepresentationRight"("identityProfileId", "status");
CREATE INDEX "PropertyRepresentationRight_organizationId_status_idx" ON "PropertyRepresentationRight"("organizationId", "status");
CREATE INDEX "PartnerOffer_propertyObjectId_status_idx" ON "PartnerOffer"("propertyObjectId", "status");
CREATE INDEX "PartnerOffer_sellerOrganizationId_status_idx" ON "PartnerOffer"("sellerOrganizationId", "status");
CREATE UNIQUE INDEX "PropertyPublicationSurface_siteConfigId_key" ON "PropertyPublicationSurface"("siteConfigId");
CREATE UNIQUE INDEX "PropertyPublicationSurface_tenantKey_key" ON "PropertyPublicationSurface"("tenantKey");
CREATE INDEX "PropertyPublicationSurface_organizationId_status_idx" ON "PropertyPublicationSurface"("organizationId", "status");
CREATE INDEX "PropertyPublicationSurface_officeId_status_idx" ON "PropertyPublicationSurface"("officeId", "status");
CREATE INDEX "PropertyPublicationGrant_publicationSurfaceId_propertyObjectId_status_idx" ON "PropertyPublicationGrant"("publicationSurfaceId", "propertyObjectId", "status");
CREATE UNIQUE INDEX "PropertyPublicationGrant_one_active_per_surface_object" ON "PropertyPublicationGrant"("publicationSurfaceId", "propertyObjectId") WHERE "status" = 'ACTIVE';
CREATE INDEX "PropertyPublicationGrant_identityProfileId_status_idx" ON "PropertyPublicationGrant"("identityProfileId", "status");
CREATE INDEX "PropertyPublicationGrant_sellerSideOrganizationId_status_idx" ON "PropertyPublicationGrant"("sellerSideOrganizationId", "status");

ALTER TABLE "PropertyOriginatorRecord" ADD CONSTRAINT "PropertyOriginatorRecord_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyOriginatorRecord" ADD CONSTRAINT "PropertyOriginatorRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyOriginatorRecord" ADD CONSTRAINT "PropertyOriginatorRecord_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyRepresentationRight" ADD CONSTRAINT "PropertyRepresentationRight_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyRepresentationRight" ADD CONSTRAINT "PropertyRepresentationRight_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyRepresentationRight" ADD CONSTRAINT "PropertyRepresentationRight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyRepresentationRight" ADD CONSTRAINT "PropertyRepresentationRight_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_representationRightId_fkey" FOREIGN KEY ("representationRightId") REFERENCES "PropertyRepresentationRight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerOffer" ADD CONSTRAINT "PartnerOffer_sellerOfficeId_fkey" FOREIGN KEY ("sellerOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationSurface" ADD CONSTRAINT "PropertyPublicationSurface_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "SiteConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationSurface" ADD CONSTRAINT "PropertyPublicationSurface_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationSurface" ADD CONSTRAINT "PropertyPublicationSurface_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_publicationSurfaceId_fkey" FOREIGN KEY ("publicationSurfaceId") REFERENCES "PropertyPublicationSurface"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_partnerOfferId_fkey" FOREIGN KEY ("partnerOfferId") REFERENCES "PartnerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_canonicalVersionId_fkey" FOREIGN KEY ("canonicalVersionId") REFERENCES "PropertyCanonicalVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_buyerSideOrganizationId_fkey" FOREIGN KEY ("buyerSideOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_buyerSideOfficeId_fkey" FOREIGN KEY ("buyerSideOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_sellerSideOrganizationId_fkey" FOREIGN KEY ("sellerSideOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyPublicationGrant" ADD CONSTRAINT "PropertyPublicationGrant_sellerSideOfficeId_fkey" FOREIGN KEY ("sellerSideOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
