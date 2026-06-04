DO $$ BEGIN
  CREATE TYPE "PartnerInteractionType" AS ENUM ('info_request', 'commercial', 'cooperation');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PartnerInteractionPriority" AS ENUM ('normal', 'urgent', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PartnerInteractionStatus" AS ENUM ('new_request', 'waiting_response', 'information_received', 'accepted', 'declined', 'in_deal', 'completed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InteractionMessageDeliveryStatus" AS ENUM ('delivered', 'read', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InteractionTranslationStatus" AS ENUM ('pending', 'translated', 'failed', 'not_required', 'edited');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InteractionAttachmentScanStatus" AS ENUM ('scan_pending', 'clean', 'blocked', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InteractionNotificationChannel" AS ENUM ('in_admin', 'telegram', 'whatsapp', 'email', 'sms');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InteractionNotificationStatus" AS ENUM ('pending', 'sent', 'failed', 'suppressed', 'read');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PartnerInteraction" (
  "id" TEXT NOT NULL,
  "initiatingOrganizationId" TEXT NOT NULL,
  "initiatingOfficeId" TEXT NOT NULL,
  "targetOrganizationId" TEXT NOT NULL,
  "targetOfficeId" TEXT NOT NULL,
  "propertyObjectId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "type" "PartnerInteractionType" NOT NULL DEFAULT 'info_request',
  "priority" "PartnerInteractionPriority" NOT NULL DEFAULT 'normal',
  "status" "PartnerInteractionStatus" NOT NULL DEFAULT 'new_request',
  "conversationLanguage" "LanguageCode" NOT NULL DEFAULT 'ru',
  "subject" TEXT,
  "initialMessage" TEXT,
  "firstTargetResponseAt" TIMESTAMP(3),
  "remindedAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "dealRoomId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InteractionMessage" (
  "id" TEXT NOT NULL,
  "interactionId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "senderOrganizationId" TEXT NOT NULL,
  "senderOfficeId" TEXT NOT NULL,
  "originalText" TEXT NOT NULL,
  "originalLanguage" "LanguageCode" NOT NULL,
  "translatedText" TEXT,
  "translatedLanguage" "LanguageCode",
  "translationStatus" "InteractionTranslationStatus" NOT NULL DEFAULT 'not_required',
  "deliveryStatus" "InteractionMessageDeliveryStatus" NOT NULL DEFAULT 'delivered',
  "readAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  "moderatedAt" TIMESTAMP(3),
  "moderatedByUserId" TEXT,
  "moderationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InteractionAttachment" (
  "id" TEXT NOT NULL,
  "interactionId" TEXT NOT NULL,
  "messageId" TEXT,
  "ownerOrganizationId" TEXT NOT NULL,
  "ownerOfficeId" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "storagePath" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "previewStoragePath" TEXT,
  "scanStatus" "InteractionAttachmentScanStatus" NOT NULL DEFAULT 'scan_pending',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InteractionEvent" (
  "id" TEXT NOT NULL,
  "interactionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorOrganizationId" TEXT,
  "actorOfficeId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InteractionTypingState" (
  "id" TEXT NOT NULL,
  "interactionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "officeId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionTypingState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InteractionNotificationSetting" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "inAdminEnabled" BOOLEAN NOT NULL DEFAULT true,
  "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
  "telegramChatId" TEXT,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappPhoneE164" TEXT,
  "whatsappTemplateName" TEXT,
  "urgentExternalEnabled" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionNotificationSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InteractionNotification" (
  "id" TEXT NOT NULL,
  "interactionId" TEXT NOT NULL,
  "messageId" TEXT,
  "recipientOrganizationId" TEXT NOT NULL,
  "recipientOfficeId" TEXT NOT NULL,
  "channel" "InteractionNotificationChannel" NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "InteractionNotificationStatus" NOT NULL DEFAULT 'pending',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "providerError" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InteractionTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "name" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "type" "PartnerInteractionType" NOT NULL DEFAULT 'info_request',
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BlockedPartner" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "blockedPartnerOrganizationId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlockedPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PartnerMetric" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "officeId" TEXT,
  "averageFirstResponseSec" INTEGER,
  "completedDealsCount" INTEGER NOT NULL DEFAULT 0,
  "acceptanceRatePercent" DECIMAL(8,4),
  "rating" DECIMAL(3,2),
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PartnerReview" (
  "id" TEXT NOT NULL,
  "interactionId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "reviewerOrganizationId" TEXT NOT NULL,
  "reviewerOfficeId" TEXT NOT NULL,
  "reviewedOrganizationId" TEXT NOT NULL,
  "reviewedOfficeId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "text" TEXT,
  "hiddenByPlatform" BOOLEAN NOT NULL DEFAULT false,
  "moderatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InteractionTranslationCache" (
  "id" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "sourceLanguage" "LanguageCode" NOT NULL,
  "targetLanguage" "LanguageCode" NOT NULL,
  "translatedText" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractionTranslationCache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerInteraction_initiatingOrganizationId_status_updatedAt_idx" ON "PartnerInteraction"("initiatingOrganizationId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "PartnerInteraction_targetOrganizationId_status_updatedAt_idx" ON "PartnerInteraction"("targetOrganizationId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "PartnerInteraction_initiatingOfficeId_status_updatedAt_idx" ON "PartnerInteraction"("initiatingOfficeId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "PartnerInteraction_targetOfficeId_status_updatedAt_idx" ON "PartnerInteraction"("targetOfficeId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "PartnerInteraction_propertyObjectId_idx" ON "PartnerInteraction"("propertyObjectId");
CREATE INDEX IF NOT EXISTS "PartnerInteraction_dealRoomId_idx" ON "PartnerInteraction"("dealRoomId");
CREATE INDEX IF NOT EXISTS "InteractionMessage_interactionId_createdAt_idx" ON "InteractionMessage"("interactionId", "createdAt");
CREATE INDEX IF NOT EXISTS "InteractionMessage_senderOrganizationId_createdAt_idx" ON "InteractionMessage"("senderOrganizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "InteractionMessage_readAt_idx" ON "InteractionMessage"("readAt");
CREATE INDEX IF NOT EXISTS "InteractionAttachment_interactionId_idx" ON "InteractionAttachment"("interactionId");
CREATE INDEX IF NOT EXISTS "InteractionAttachment_messageId_idx" ON "InteractionAttachment"("messageId");
CREATE INDEX IF NOT EXISTS "InteractionAttachment_ownerOfficeId_idx" ON "InteractionAttachment"("ownerOfficeId");
CREATE INDEX IF NOT EXISTS "InteractionEvent_interactionId_createdAt_idx" ON "InteractionEvent"("interactionId", "createdAt");
CREATE INDEX IF NOT EXISTS "InteractionEvent_actorOrganizationId_idx" ON "InteractionEvent"("actorOrganizationId");
CREATE INDEX IF NOT EXISTS "InteractionEvent_actorOfficeId_idx" ON "InteractionEvent"("actorOfficeId");
CREATE UNIQUE INDEX IF NOT EXISTS "InteractionTypingState_interactionId_organizationId_officeId_key" ON "InteractionTypingState"("interactionId", "organizationId", "officeId");
CREATE INDEX IF NOT EXISTS "InteractionTypingState_interactionId_expiresAt_idx" ON "InteractionTypingState"("interactionId", "expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "InteractionNotificationSetting_organizationId_key" ON "InteractionNotificationSetting"("organizationId");
CREATE INDEX IF NOT EXISTS "InteractionNotification_recipientOrganizationId_status_createdAt_idx" ON "InteractionNotification"("recipientOrganizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "InteractionNotification_recipientOfficeId_status_createdAt_idx" ON "InteractionNotification"("recipientOfficeId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "InteractionNotification_interactionId_createdAt_idx" ON "InteractionNotification"("interactionId", "createdAt");
CREATE INDEX IF NOT EXISTS "InteractionNotification_channel_status_nextAttemptAt_idx" ON "InteractionNotification"("channel", "status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "InteractionTemplate_organizationId_system_idx" ON "InteractionTemplate"("organizationId", "system");
CREATE UNIQUE INDEX IF NOT EXISTS "BlockedPartner_organizationId_blockedPartnerOrganizationId_key" ON "BlockedPartner"("organizationId", "blockedPartnerOrganizationId");
CREATE INDEX IF NOT EXISTS "BlockedPartner_blockedPartnerOrganizationId_idx" ON "BlockedPartner"("blockedPartnerOrganizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerMetric_organizationId_officeId_key" ON "PartnerMetric"("organizationId", "officeId");
CREATE INDEX IF NOT EXISTS "PartnerMetric_organizationId_idx" ON "PartnerMetric"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerReview_interactionId_reviewerOrganizationId_reviewedOrganizationId_key" ON "PartnerReview"("interactionId", "reviewerOrganizationId", "reviewedOrganizationId");
CREATE INDEX IF NOT EXISTS "PartnerReview_reviewedOrganizationId_hiddenByPlatform_idx" ON "PartnerReview"("reviewedOrganizationId", "hiddenByPlatform");
CREATE UNIQUE INDEX IF NOT EXISTS "InteractionTranslationCache_sourceHash_sourceLanguage_targetLanguage_provider_key" ON "InteractionTranslationCache"("sourceHash", "sourceLanguage", "targetLanguage", "provider");

ALTER TABLE "PartnerInteraction" ADD CONSTRAINT "PartnerInteraction_initiatingOrganizationId_fkey" FOREIGN KEY ("initiatingOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerInteraction" ADD CONSTRAINT "PartnerInteraction_initiatingOfficeId_fkey" FOREIGN KEY ("initiatingOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerInteraction" ADD CONSTRAINT "PartnerInteraction_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerInteraction" ADD CONSTRAINT "PartnerInteraction_targetOfficeId_fkey" FOREIGN KEY ("targetOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerInteraction" ADD CONSTRAINT "PartnerInteraction_propertyObjectId_fkey" FOREIGN KEY ("propertyObjectId") REFERENCES "PropertyObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerInteraction" ADD CONSTRAINT "PartnerInteraction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InteractionMessage" ADD CONSTRAINT "InteractionMessage_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "PartnerInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionMessage" ADD CONSTRAINT "InteractionMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InteractionMessage" ADD CONSTRAINT "InteractionMessage_senderOrganizationId_fkey" FOREIGN KEY ("senderOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InteractionMessage" ADD CONSTRAINT "InteractionMessage_senderOfficeId_fkey" FOREIGN KEY ("senderOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InteractionAttachment" ADD CONSTRAINT "InteractionAttachment_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "PartnerInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionAttachment" ADD CONSTRAINT "InteractionAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InteractionMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InteractionAttachment" ADD CONSTRAINT "InteractionAttachment_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InteractionAttachment" ADD CONSTRAINT "InteractionAttachment_ownerOfficeId_fkey" FOREIGN KEY ("ownerOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InteractionAttachment" ADD CONSTRAINT "InteractionAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InteractionEvent" ADD CONSTRAINT "InteractionEvent_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "PartnerInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionTypingState" ADD CONSTRAINT "InteractionTypingState_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "PartnerInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionTypingState" ADD CONSTRAINT "InteractionTypingState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionTypingState" ADD CONSTRAINT "InteractionTypingState_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionNotificationSetting" ADD CONSTRAINT "InteractionNotificationSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionNotification" ADD CONSTRAINT "InteractionNotification_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "PartnerInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionNotification" ADD CONSTRAINT "InteractionNotification_recipientOrganizationId_fkey" FOREIGN KEY ("recipientOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionNotification" ADD CONSTRAINT "InteractionNotification_recipientOfficeId_fkey" FOREIGN KEY ("recipientOfficeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InteractionTemplate" ADD CONSTRAINT "InteractionTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedPartner" ADD CONSTRAINT "BlockedPartner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedPartner" ADD CONSTRAINT "BlockedPartner_blockedPartnerOrganizationId_fkey" FOREIGN KEY ("blockedPartnerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerMetric" ADD CONSTRAINT "PartnerMetric_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "PartnerInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_reviewerOrganizationId_fkey" FOREIGN KEY ("reviewerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_reviewerOfficeId_fkey" FOREIGN KEY ("reviewerOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_reviewedOrganizationId_fkey" FOREIGN KEY ("reviewedOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerReview" ADD CONSTRAINT "PartnerReview_reviewedOfficeId_fkey" FOREIGN KEY ("reviewedOfficeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
