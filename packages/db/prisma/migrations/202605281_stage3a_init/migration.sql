-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('ru', 'en', 'ka', 'hy', 'ar');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('RUB', 'USD', 'EUR', 'GEL', 'AMD', 'AED');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('platform_owner', 'platform_admin', 'platform_analyst', 'platform_viewer');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('organization_owner', 'organization_admin');

-- CreateEnum
CREATE TYPE "OfficeRole" AS ENUM ('office_owner', 'office_admin', 'broker', 'office_analyst', 'office_viewer');

-- CreateEnum
CREATE TYPE "LifecycleStatus" AS ENUM ('draft', 'active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('private', 'office_network', 'public');

-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('land', 'apartment', 'house', 'warehouse', 'industrial_site', 'factory', 'hotel', 'office', 'retail', 'mixed_use', 'development_project', 'investment_project', 'other');

-- CreateEnum
CREATE TYPE "PriceMode" AS ENUM ('on_request', 'fixed', 'range');

-- CreateEnum
CREATE TYPE "RepresentationSide" AS ENUM ('owner', 'seller', 'landlord', 'originator');

-- CreateEnum
CREATE TYPE "Exclusivity" AS ENUM ('exclusive', 'non_exclusive', 'unknown');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('land_plot', 'building', 'apartment_unit', 'house', 'warehouse', 'production_facility', 'office_block', 'retail_unit', 'utility_infrastructure', 'development_phase', 'economic_unit', 'other');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "SourceConfidence" AS ENUM ('high', 'medium', 'low', 'unsupported');

-- CreateEnum
CREATE TYPE "IntakeSourceType" AS ENUM ('text', 'file', 'mixed');

-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('received', 'extracting', 'needs_clarification', 'draft_ready', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "AIDraftStatus" AS ENUM ('draft', 'needs_clarification', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "ExternalCheckResult" AS ENUM ('confirmed', 'not_found', 'conflict', 'outdated', 'unsupported');

-- CreateEnum
CREATE TYPE "ClientIntentStatus" AS ENUM ('new', 'qualified', 'in_deal_room', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "CoBrokerRequestStatus" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired', 'closed');

-- CreateEnum
CREATE TYPE "DealRoomStatus" AS ENUM ('draft', 'sent', 'viewed', 'active', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'past_due', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "LegalDocumentScope" AS ENUM ('organization', 'office', 'property_object', 'client_intent', 'deal_room', 'transaction', 'other');

-- CreateEnum
CREATE TYPE "LegalDocumentKind" AS ENUM ('ownership_certificate', 'cadastral_extract', 'title_document', 'lease_agreement', 'sale_purchase_agreement', 'power_of_attorney', 'corporate_document', 'passport_or_id', 'tax_document', 'encumbrance_certificate', 'technical_passport', 'floor_plan', 'permit', 'due_diligence_report', 'valuation_report', 'nda', 'broker_agreement', 'commission_agreement', 'other');

-- CreateEnum
CREATE TYPE "LegalReviewStatus" AS ENUM ('not_reviewed', 'pending_review', 'needs_clarification', 'verified', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "DocumentConfidentiality" AS ENUM ('public', 'office_private', 'organization_private', 'deal_participants', 'platform_private');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "countryOfRegistration" TEXT NOT NULL,
    "operatingCountryCodes" TEXT[],
    "defaultLanguage" "LanguageCode" NOT NULL DEFAULT 'ru',
    "supportedLanguages" "LanguageCode"[] DEFAULT ARRAY['ru']::"LanguageCode"[],
    "defaultCurrency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "supportedCurrencies" "CurrencyCode"[] DEFAULT ARRAY['USD']::"CurrencyCode"[],
    "status" "LifecycleStatus" NOT NULL DEFAULT 'draft',
    "subscriptionPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationLocalization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationLocalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "defaultMarketId" TEXT,
    "defaultLanguage" "LanguageCode" NOT NULL DEFAULT 'ru',
    "supportedLanguages" "LanguageCode"[] DEFAULT ARRAY['ru']::"LanguageCode"[],
    "defaultCurrency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "supportedCurrencies" "CurrencyCode"[] DEFAULT ARRAY['USD']::"CurrencyCode"[],
    "status" "LifecycleStatus" NOT NULL DEFAULT 'draft',
    "websiteConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeLocalization" (
    "id" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeLocalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "defaultCurrency" "CurrencyCode" NOT NULL,
    "supportedCurrencies" "CurrencyCode"[],
    "supportedLanguages" "LanguageCode"[],
    "assetClasses" "AssetClass"[],
    "complianceRegion" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" "OrganizationRole"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" "OfficeRole"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "domain" TEXT,
    "subdomain" TEXT,
    "defaultLanguage" "LanguageCode" NOT NULL,
    "supportedLanguages" "LanguageCode"[],
    "defaultCurrency" "CurrencyCode" NOT NULL,
    "supportedCurrencies" "CurrencyCode"[],
    "primaryMarketIds" TEXT[],
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteConfigLocalization" (
    "id" TEXT NOT NULL,
    "siteConfigId" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "brandName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteConfigLocalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyObject" (
    "id" TEXT NOT NULL,
    "ownerOrganizationId" TEXT NOT NULL,
    "ownerOfficeId" TEXT NOT NULL,
    "informationOwnerOrganizationId" TEXT NOT NULL,
    "informationOwnerOfficeId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'draft',
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "assetClass" "AssetClass" NOT NULL,
    "assetSubtype" TEXT,
    "addressPrivate" TEXT,
    "areaSqm" DECIMAL(14,2),
    "landAreaSqm" DECIMAL(14,2),
    "buildingAreaSqm" DECIMAL(14,2),
    "rentableAreaSqm" DECIMAL(14,2),
    "floorNumber" INTEGER,
    "floorsTotal" INTEGER,
    "roomsCount" INTEGER,
    "bedroomsCount" INTEGER,
    "bathroomsCount" INTEGER,
    "cadastralNumber" TEXT,
    "priceMode" "PriceMode" NOT NULL DEFAULT 'on_request',
    "priceAmount" DECIMAL(18,2),
    "priceCurrency" "CurrencyCode",
    "priceMinAmount" DECIMAL(18,2),
    "priceMaxAmount" DECIMAL(18,2),
    "representationSide" "RepresentationSide" NOT NULL DEFAULT 'seller',
    "exclusivity" "Exclusivity" NOT NULL DEFAULT 'unknown',
    "canBeShownByOtherOffices" BOOLEAN NOT NULL DEFAULT false,
    "requiresOwnerOfficeApprovalForLead" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyObjectLocalization" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "addressDisplay" TEXT NOT NULL,
    "tags" TEXT[],
    "priceDisplay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyObjectLocalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyObjectComponent" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "componentType" "ComponentType" NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB,
    "areaSqm" DECIMAL(14,2),
    "landAreaSqm" DECIMAL(14,2),
    "cadastralNumber" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyObjectComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyObjectAttribute" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "componentId" TEXT,
    "key" TEXT NOT NULL,
    "valueText" JSONB,
    "valueNumber" DECIMAL(18,4),
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "unit" TEXT,
    "group" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyObjectAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyObjectEconomics" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "priceMode" "PriceMode",
    "priceAmount" DECIMAL(18,2),
    "priceCurrency" "CurrencyCode",
    "rentalIncomeMonthly" DECIMAL(18,2),
    "rentalIncomeCurrency" "CurrencyCode",
    "operatingExpensesMonthly" DECIMAL(18,2),
    "operatingExpensesCurrency" "CurrencyCode",
    "noiAnnual" DECIMAL(18,2),
    "noiCurrency" "CurrencyCode",
    "capRatePercent" DECIMAL(8,4),
    "paybackYears" DECIMAL(8,2),
    "occupancyPercent" DECIMAL(8,4),
    "projectedRevenue" DECIMAL(18,2),
    "projectedRevenueCurrency" "CurrencyCode",
    "projectedCost" DECIMAL(18,2),
    "projectedCostCurrency" "CurrencyCode",
    "source" TEXT,
    "confidence" "SourceConfidence" NOT NULL DEFAULT 'unsupported',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyObjectEconomics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "ownerOrganizationId" TEXT NOT NULL,
    "ownerOfficeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "kind" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyDocument" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "ownerOrganizationId" TEXT NOT NULL,
    "ownerOfficeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT,
    "propertyObjectId" TEXT,
    "clientIntentId" TEXT,
    "dealRoomId" TEXT,
    "uploadedByUserId" TEXT,
    "scope" "LegalDocumentScope" NOT NULL,
    "kind" "LegalDocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "confidentiality" "DocumentConfidentiality" NOT NULL DEFAULT 'organization_private',
    "reviewStatus" "LegalReviewStatus" NOT NULL DEFAULT 'not_reviewed',
    "issuingAuthority" TEXT,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentReview" (
    "id" TEXT NOT NULL,
    "legalDocumentId" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "status" "LegalReviewStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIntakeSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "sourceType" "IntakeSourceType" NOT NULL,
    "rawText" TEXT,
    "fileRefs" TEXT[],
    "status" "IntakeStatus" NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIntakeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAIDraft" (
    "id" TEXT NOT NULL,
    "intakeSubmissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "proposedAssetClass" "AssetClass",
    "proposedPropertyObject" JSONB,
    "proposedComponents" JSONB,
    "proposedAttributes" JSONB,
    "proposedEconomics" JSONB,
    "confidence" "Confidence" NOT NULL,
    "fieldConfidence" JSONB,
    "missingFields" TEXT[],
    "conflicts" TEXT[],
    "clarificationQuestions" TEXT[],
    "verificationSummary" JSONB,
    "status" "AIDraftStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyAIDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAIExternalCheck" (
    "id" TEXT NOT NULL,
    "intakeSubmissionId" TEXT NOT NULL,
    "draftId" TEXT,
    "propertyObjectId" TEXT,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "checkedField" TEXT NOT NULL,
    "claimedValue" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "sourcePublishedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "ExternalCheckResult" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PropertyAIExternalCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAIExtractionEvent" (
    "id" TEXT NOT NULL,
    "intakeSubmissionId" TEXT NOT NULL,
    "draftId" TEXT,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "actorUid" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyAIExtractionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientIntent" (
    "id" TEXT NOT NULL,
    "sourceOrganizationId" TEXT NOT NULL,
    "sourceOfficeId" TEXT NOT NULL,
    "sourceWebsiteId" TEXT,
    "marketId" TEXT,
    "preferredLanguage" "LanguageCode" NOT NULL,
    "preferredCurrency" "CurrencyCode" NOT NULL,
    "requirementText" TEXT NOT NULL,
    "status" "ClientIntentStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientIntentPrivateDetails" (
    "id" TEXT NOT NULL,
    "clientIntentId" TEXT NOT NULL,
    "clientName" TEXT,
    "clientContact" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientIntentPrivateDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoBrokerRequest" (
    "id" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "fromOrganizationId" TEXT NOT NULL,
    "fromOfficeId" TEXT NOT NULL,
    "toOrganizationId" TEXT NOT NULL,
    "toOfficeId" TEXT NOT NULL,
    "clientIntentId" TEXT,
    "status" "CoBrokerRequestStatus" NOT NULL DEFAULT 'draft',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoBrokerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoom" (
    "id" TEXT NOT NULL,
    "clientIntentId" TEXT NOT NULL,
    "sellerOrganizationId" TEXT NOT NULL,
    "sellerOfficeId" TEXT NOT NULL,
    "buyerOrganizationId" TEXT NOT NULL,
    "buyerOfficeId" TEXT NOT NULL,
    "status" "DealRoomStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoomObject" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "propertyObjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealRoomObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoomEvent" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "authorUid" TEXT,
    "authorOrganizationId" TEXT,
    "authorOfficeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealRoomEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPrice" DECIMAL(18,2),
    "monthlyCurrency" "CurrencyCode",
    "annualPrice" DECIMAL(18,2),
    "annualCurrency" "CurrencyCode",
    "objectLimit" INTEGER,
    "agentLimit" INTEGER,
    "websiteLimit" INTEGER,
    "analyticsAccess" TEXT NOT NULL DEFAULT 'none',
    "supportLevel" TEXT NOT NULL DEFAULT 'standard',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRateSnapshot" (
    "id" TEXT NOT NULL,
    "baseCurrency" "CurrencyCode" NOT NULL,
    "quoteCurrency" "CurrencyCode" NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyRateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketIndicator" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "segment" TEXT,
    "value" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "currency" "CurrencyCode",
    "period" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" "SourceConfidence" NOT NULL DEFAULT 'unsupported',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketInsight" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "sources" TEXT[],
    "confidence" "SourceConfidence" NOT NULL DEFAULT 'unsupported',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorUid" TEXT,
    "actorOrganizationId" TEXT,
    "actorOfficeId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationLocalization_organizationId_language_key" ON "OrganizationLocalization"("organizationId", "language");

-- CreateIndex
CREATE INDEX "Office_organizationId_idx" ON "Office"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Office_organizationId_slug_key" ON "Office"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeLocalization_officeId_language_key" ON "OfficeLocalization"("officeId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "Market_slug_key" ON "Market"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_firebaseUid_key" ON "AppUser"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRoleAssignment_userId_role_key" ON "PlatformRoleAssignment"("userId", "role");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OfficeMembership_organizationId_userId_idx" ON "OfficeMembership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeMembership_officeId_userId_key" ON "OfficeMembership"("officeId", "userId");

-- CreateIndex
CREATE INDEX "SiteConfig_organizationId_idx" ON "SiteConfig"("organizationId");

-- CreateIndex
CREATE INDEX "SiteConfig_officeId_idx" ON "SiteConfig"("officeId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteConfigLocalization_siteConfigId_language_key" ON "SiteConfigLocalization"("siteConfigId", "language");

-- CreateIndex
CREATE INDEX "PropertyObject_ownerOrganizationId_idx" ON "PropertyObject"("ownerOrganizationId");

-- CreateIndex
CREATE INDEX "PropertyObject_ownerOfficeId_idx" ON "PropertyObject"("ownerOfficeId");

-- CreateIndex
CREATE INDEX "PropertyObject_marketId_status_visibility_publishedAt_idx" ON "PropertyObject"("marketId", "status", "visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "PropertyObject_assetClass_status_visibility_publishedAt_idx" ON "PropertyObject"("assetClass", "status", "visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "PropertyObject_ownerOfficeId_status_visibility_publishedAt_idx" ON "PropertyObject"("ownerOfficeId", "status", "visibility", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyObjectLocalization_propertyObjectId_language_key" ON "PropertyObjectLocalization"("propertyObjectId", "language");

-- CreateIndex
CREATE INDEX "PropertyObjectComponent_propertyObjectId_idx" ON "PropertyObjectComponent"("propertyObjectId");

-- CreateIndex
CREATE INDEX "PropertyObjectAttribute_propertyObjectId_key_idx" ON "PropertyObjectAttribute"("propertyObjectId", "key");

-- CreateIndex
CREATE INDEX "PropertyObjectAttribute_componentId_idx" ON "PropertyObjectAttribute"("componentId");

-- CreateIndex
CREATE INDEX "PropertyObjectEconomics_propertyObjectId_idx" ON "PropertyObjectEconomics"("propertyObjectId");

-- CreateIndex
CREATE INDEX "PropertyMedia_propertyObjectId_idx" ON "PropertyMedia"("propertyObjectId");

-- CreateIndex
CREATE INDEX "PropertyMedia_ownerOfficeId_idx" ON "PropertyMedia"("ownerOfficeId");

-- CreateIndex
CREATE INDEX "PropertyDocument_propertyObjectId_idx" ON "PropertyDocument"("propertyObjectId");

-- CreateIndex
CREATE INDEX "PropertyDocument_ownerOfficeId_idx" ON "PropertyDocument"("ownerOfficeId");

-- CreateIndex
CREATE INDEX "LegalDocument_organizationId_scope_idx" ON "LegalDocument"("organizationId", "scope");

-- CreateIndex
CREATE INDEX "LegalDocument_officeId_idx" ON "LegalDocument"("officeId");

-- CreateIndex
CREATE INDEX "LegalDocument_propertyObjectId_idx" ON "LegalDocument"("propertyObjectId");

-- CreateIndex
CREATE INDEX "LegalDocument_clientIntentId_idx" ON "LegalDocument"("clientIntentId");

-- CreateIndex
CREATE INDEX "LegalDocument_dealRoomId_idx" ON "LegalDocument"("dealRoomId");

-- CreateIndex
CREATE INDEX "LegalDocument_reviewStatus_idx" ON "LegalDocument"("reviewStatus");

-- CreateIndex
CREATE INDEX "LegalDocument_expiresAt_idx" ON "LegalDocument"("expiresAt");

-- CreateIndex
CREATE INDEX "LegalDocumentReview_legalDocumentId_createdAt_idx" ON "LegalDocumentReview"("legalDocumentId", "createdAt");

-- CreateIndex
CREATE INDEX "LegalDocumentReview_reviewerUserId_idx" ON "LegalDocumentReview"("reviewerUserId");

-- CreateIndex
CREATE INDEX "PropertyIntakeSubmission_organizationId_officeId_idx" ON "PropertyIntakeSubmission"("organizationId", "officeId");

-- CreateIndex
CREATE INDEX "PropertyIntakeSubmission_createdByUserId_idx" ON "PropertyIntakeSubmission"("createdByUserId");

-- CreateIndex
CREATE INDEX "PropertyAIDraft_intakeSubmissionId_idx" ON "PropertyAIDraft"("intakeSubmissionId");

-- CreateIndex
CREATE INDEX "PropertyAIDraft_organizationId_officeId_idx" ON "PropertyAIDraft"("organizationId", "officeId");

-- CreateIndex
CREATE INDEX "PropertyAIExternalCheck_intakeSubmissionId_idx" ON "PropertyAIExternalCheck"("intakeSubmissionId");

-- CreateIndex
CREATE INDEX "PropertyAIExternalCheck_draftId_idx" ON "PropertyAIExternalCheck"("draftId");

-- CreateIndex
CREATE INDEX "PropertyAIExternalCheck_propertyObjectId_idx" ON "PropertyAIExternalCheck"("propertyObjectId");

-- CreateIndex
CREATE INDEX "PropertyAIExtractionEvent_intakeSubmissionId_idx" ON "PropertyAIExtractionEvent"("intakeSubmissionId");

-- CreateIndex
CREATE INDEX "PropertyAIExtractionEvent_draftId_idx" ON "PropertyAIExtractionEvent"("draftId");

-- CreateIndex
CREATE INDEX "ClientIntent_sourceOrganizationId_idx" ON "ClientIntent"("sourceOrganizationId");

-- CreateIndex
CREATE INDEX "ClientIntent_sourceOfficeId_status_idx" ON "ClientIntent"("sourceOfficeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientIntentPrivateDetails_clientIntentId_key" ON "ClientIntentPrivateDetails"("clientIntentId");

-- CreateIndex
CREATE INDEX "CoBrokerRequest_propertyObjectId_idx" ON "CoBrokerRequest"("propertyObjectId");

-- CreateIndex
CREATE INDEX "CoBrokerRequest_fromOfficeId_status_idx" ON "CoBrokerRequest"("fromOfficeId", "status");

-- CreateIndex
CREATE INDEX "CoBrokerRequest_toOfficeId_status_idx" ON "CoBrokerRequest"("toOfficeId", "status");

-- CreateIndex
CREATE INDEX "DealRoom_sellerOfficeId_status_idx" ON "DealRoom"("sellerOfficeId", "status");

-- CreateIndex
CREATE INDEX "DealRoom_buyerOfficeId_status_idx" ON "DealRoom"("buyerOfficeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomObject_dealRoomId_propertyObjectId_key" ON "DealRoomObject"("dealRoomId", "propertyObjectId");

-- CreateIndex
CREATE INDEX "DealRoomEvent_dealRoomId_createdAt_idx" ON "DealRoomEvent"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficeSubscription_organizationId_idx" ON "OfficeSubscription"("organizationId");

-- CreateIndex
CREATE INDEX "OfficeSubscription_officeId_idx" ON "OfficeSubscription"("officeId");

-- CreateIndex
CREATE INDEX "MarketIndicator_marketId_published_idx" ON "MarketIndicator"("marketId", "published");

-- CreateIndex
CREATE INDEX "MarketInsight_marketId_published_idx" ON "MarketInsight"("marketId", "published");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorOrganizationId_idx" ON "AuditLog"("actorOrganizationId");

-- CreateIndex
CREATE INDEX "AuditLog_actorOfficeId_idx" ON "AuditLog"("actorOfficeId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationLocalization" ADD CONSTRAINT "OrganizationLocalization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_defaultMarketId_fkey" FOREIGN KEY ("defaultMarketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeLocalization" ADD CONSTRAINT "OfficeLocalization_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMembership" ADD CONSTRAINT "OfficeMembership_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMembership" ADD CONSTRAINT "OfficeMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteConfig" ADD CONSTRAINT "SiteConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteConfig" ADD CONSTRAINT "SiteConfig_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteConfigLocalization" ADD CONSTRAINT "SiteConfigLocalization_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "SiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObject" ADD CONSTRAINT "PropertyObject_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObject" ADD CONSTRAINT "PropertyObject_ownerOfficeId_fkey" FOREIGN KEY ("ownerOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObject" ADD CONSTRAINT "PropertyObject_informationOwnerOrganizationId_fkey" FOREIGN KEY ("informationOwnerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObject" ADD CONSTRAINT "PropertyObject_informationOwnerOfficeId_fkey" FOREIGN KEY ("informationOwnerOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObject" ADD CONSTRAINT "PropertyObject_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObject" ADD CONSTRAINT "PropertyObject_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObjectLocalization" ADD CONSTRAINT "PropertyObjectLocalization_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObjectComponent" ADD CONSTRAINT "PropertyObjectComponent_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObjectAttribute" ADD CONSTRAINT "PropertyObjectAttribute_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObjectAttribute" ADD CONSTRAINT "PropertyObjectAttribute_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PropertyObjectComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyObjectEconomics" ADD CONSTRAINT "PropertyObjectEconomics_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_clientIntentId_fkey" FOREIGN KEY ("clientIntentId") REFERENCES "ClientIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocumentReview" ADD CONSTRAINT "LegalDocumentReview_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocumentReview" ADD CONSTRAINT "LegalDocumentReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIntakeSubmission" ADD CONSTRAINT "PropertyIntakeSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIntakeSubmission" ADD CONSTRAINT "PropertyIntakeSubmission_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIntakeSubmission" ADD CONSTRAINT "PropertyIntakeSubmission_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIDraft" ADD CONSTRAINT "PropertyAIDraft_intakeSubmissionId_fkey" FOREIGN KEY ("intakeSubmissionId") REFERENCES "PropertyIntakeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIDraft" ADD CONSTRAINT "PropertyAIDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIDraft" ADD CONSTRAINT "PropertyAIDraft_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIDraft" ADD CONSTRAINT "PropertyAIDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIExternalCheck" ADD CONSTRAINT "PropertyAIExternalCheck_intakeSubmissionId_fkey" FOREIGN KEY ("intakeSubmissionId") REFERENCES "PropertyIntakeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIExternalCheck" ADD CONSTRAINT "PropertyAIExternalCheck_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PropertyAIDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIExternalCheck" ADD CONSTRAINT "PropertyAIExternalCheck_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIExternalCheck" ADD CONSTRAINT "PropertyAIExternalCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIExternalCheck" ADD CONSTRAINT "PropertyAIExternalCheck_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIExtractionEvent" ADD CONSTRAINT "PropertyAIExtractionEvent_intakeSubmissionId_fkey" FOREIGN KEY ("intakeSubmissionId") REFERENCES "PropertyIntakeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAIExtractionEvent" ADD CONSTRAINT "PropertyAIExtractionEvent_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "PropertyAIDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntent" ADD CONSTRAINT "ClientIntent_sourceOrganizationId_fkey" FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntent" ADD CONSTRAINT "ClientIntent_sourceOfficeId_fkey" FOREIGN KEY ("sourceOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntent" ADD CONSTRAINT "ClientIntent_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntentPrivateDetails" ADD CONSTRAINT "ClientIntentPrivateDetails_clientIntentId_fkey" FOREIGN KEY ("clientIntentId") REFERENCES "ClientIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoBrokerRequest" ADD CONSTRAINT "CoBrokerRequest_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoBrokerRequest" ADD CONSTRAINT "CoBrokerRequest_clientIntentId_fkey" FOREIGN KEY ("clientIntentId") REFERENCES "ClientIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_clientIntentId_fkey" FOREIGN KEY ("clientIntentId") REFERENCES "ClientIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomObject" ADD CONSTRAINT "DealRoomObject_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomObject" ADD CONSTRAINT "DealRoomObject_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomEvent" ADD CONSTRAINT "DealRoomEvent_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSubscription" ADD CONSTRAINT "OfficeSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSubscription" ADD CONSTRAINT "OfficeSubscription_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSubscription" ADD CONSTRAINT "OfficeSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketIndicator" ADD CONSTRAINT "MarketIndicator_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketInsight" ADD CONSTRAINT "MarketInsight_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

