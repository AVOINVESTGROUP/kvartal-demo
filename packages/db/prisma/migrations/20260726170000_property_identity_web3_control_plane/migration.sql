-- CreateEnum
CREATE TYPE "CorporateWalletStatus" AS ENUM ('DRAFT', 'CHALLENGE_ISSUED', 'VERIFIED', 'ACTIVE', 'FROZEN', 'ROTATION_PENDING', 'REPLACED', 'RECOVERY_PENDING');

-- CreateEnum
CREATE TYPE "CorporateWalletOperationStatus" AS ENUM ('PENDING_SAFE_SIGNATURE', 'READY_TO_EXECUTE', 'SUBMITTED', 'CONFIRMED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PropertyTokenStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'SUPERSEDED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "PropertyTokenOperationStatus" AS ENUM ('PENDING_REGISTRY_SAFE', 'READY_TO_EXECUTE', 'SUBMITTED', 'CONFIRMED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'IN_SYNC', 'STATE_MISMATCH', 'RPC_UNAVAILABLE', 'REORG_DETECTED', 'FAILED');

-- CreateTable
CREATE TABLE "OrganizationCorporateWallet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "safeVersion" TEXT,
    "status" "CorporateWalletStatus" NOT NULL DEFAULT 'DRAFT',
    "threshold" INTEGER,
    "ownerCount" INTEGER,
    "ownersHash" TEXT,
    "lastOnChainSyncAt" TIMESTAMP(3),
    "lastChallengeNonce" TEXT,
    "lastChallengeExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationCorporateWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateWalletSigner" (
    "id" TEXT NOT NULL,
    "corporateWalletId" TEXT NOT NULL,
    "signerAddress" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "CorporateWalletSigner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateWalletPolicy" (
    "id" TEXT NOT NULL,
    "corporateWalletId" TEXT NOT NULL,
    "minThreshold" INTEGER NOT NULL,
    "makerCheckerRequired" BOOLEAN NOT NULL DEFAULT true,
    "highRiskOperationTypes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateWalletPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateWalletOperation" (
    "id" TEXT NOT NULL,
    "corporateWalletId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" "CorporateWalletOperationStatus" NOT NULL DEFAULT 'PENDING_SAFE_SIGNATURE',
    "payloadJson" JSONB NOT NULL,
    "safeTxHash" TEXT,
    "chainTxHash" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CorporateWalletOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateWalletApproval" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "approvalRole" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "signature" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateWalletApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainContractRegistry" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractType" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "abiHash" TEXT NOT NULL,
    "deploymentTxHash" TEXT NOT NULL,
    "explorerUrl" TEXT,
    "status" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainContractRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyIdentityToken" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "tokenId" DECIMAL(78,0) NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "ownerWalletId" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "status" "PropertyTokenStatus" NOT NULL DEFAULT 'PENDING',
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenUri" TEXT,
    "lastTxHash" TEXT,
    "issuedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "reassignedAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyIdentityToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyTokenOperation" (
    "id" TEXT NOT NULL,
    "tokenRecordId" TEXT,
    "identityProfileId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" "PropertyTokenOperationStatus" NOT NULL DEFAULT 'PENDING_REGISTRY_SAFE',
    "payloadJson" JSONB NOT NULL,
    "registrySafeTxHash" TEXT,
    "chainTxHash" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "PropertyTokenOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyTokenEvent" (
    "id" TEXT NOT NULL,
    "tokenRecordId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyTokenEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainReconciliationCheckpoint" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "lastBlockNumber" BIGINT NOT NULL,
    "lastBlockHash" TEXT,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "lastRunAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainReconciliationCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainReconciliationIssue" (
    "id" TEXT NOT NULL,
    "tokenRecordId" TEXT,
    "issueType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "publicStatus" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "remediationCaseId" TEXT,
    "detailsRedacted" JSONB NOT NULL,

    CONSTRAINT "BlockchainReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationCorporateWallet_organizationId_chainId_status_idx" ON "OrganizationCorporateWallet"("organizationId", "chainId", "status");

-- CreateIndex
CREATE INDEX "OrganizationCorporateWallet_walletAddress_chainId_idx" ON "OrganizationCorporateWallet"("walletAddress", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationCorporateWallet_organizationId_chainId_walletAd_key" ON "OrganizationCorporateWallet"("organizationId", "chainId", "walletAddress");

-- CreateIndex
CREATE INDEX "CorporateWalletSigner_userId_active_idx" ON "CorporateWalletSigner"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateWalletSigner_corporateWalletId_signerAddress_key" ON "CorporateWalletSigner"("corporateWalletId", "signerAddress");

-- CreateIndex
CREATE INDEX "CorporateWalletPolicy_corporateWalletId_active_idx" ON "CorporateWalletPolicy"("corporateWalletId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateWalletOperation_idempotencyKey_key" ON "CorporateWalletOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CorporateWalletOperation_status_operationType_idx" ON "CorporateWalletOperation"("status", "operationType");

-- CreateIndex
CREATE INDEX "CorporateWalletOperation_corporateWalletId_status_idx" ON "CorporateWalletOperation"("corporateWalletId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateWalletApproval_operationId_approverUserId_approval_key" ON "CorporateWalletApproval"("operationId", "approverUserId", "approvalRole");

-- CreateIndex
CREATE INDEX "BlockchainContractRegistry_chainId_contractAddress_active_idx" ON "BlockchainContractRegistry"("chainId", "contractAddress", "active");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainContractRegistry_chainId_contractType_version_key" ON "BlockchainContractRegistry"("chainId", "contractType", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentityToken_identityProfileId_key" ON "PropertyIdentityToken"("identityProfileId");

-- CreateIndex
CREATE INDEX "PropertyIdentityToken_status_reconciliationStatus_idx" ON "PropertyIdentityToken"("status", "reconciliationStatus");

-- CreateIndex
CREATE INDEX "PropertyIdentityToken_ownerWalletId_status_idx" ON "PropertyIdentityToken"("ownerWalletId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyIdentityToken_chainId_contractAddress_tokenId_key" ON "PropertyIdentityToken"("chainId", "contractAddress", "tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyTokenOperation_idempotencyKey_key" ON "PropertyTokenOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PropertyTokenOperation_status_operationType_idx" ON "PropertyTokenOperation"("status", "operationType");

-- CreateIndex
CREATE INDEX "PropertyTokenOperation_identityProfileId_status_idx" ON "PropertyTokenOperation"("identityProfileId", "status");

-- CreateIndex
CREATE INDEX "PropertyTokenEvent_tokenRecordId_blockNumber_idx" ON "PropertyTokenEvent"("tokenRecordId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyTokenEvent_chainId_txHash_logIndex_key" ON "PropertyTokenEvent"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainReconciliationCheckpoint_chainId_contractAddress_key" ON "BlockchainReconciliationCheckpoint"("chainId", "contractAddress");

-- CreateIndex
CREATE INDEX "BlockchainReconciliationIssue_status_issueType_idx" ON "BlockchainReconciliationIssue"("status", "issueType");

-- CreateIndex
CREATE INDEX "BlockchainReconciliationIssue_tokenRecordId_status_idx" ON "BlockchainReconciliationIssue"("tokenRecordId", "status");

-- AddForeignKey
ALTER TABLE "OrganizationCorporateWallet" ADD CONSTRAINT "OrganizationCorporateWallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateWalletSigner" ADD CONSTRAINT "CorporateWalletSigner_corporateWalletId_fkey" FOREIGN KEY ("corporateWalletId") REFERENCES "OrganizationCorporateWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateWalletPolicy" ADD CONSTRAINT "CorporateWalletPolicy_corporateWalletId_fkey" FOREIGN KEY ("corporateWalletId") REFERENCES "OrganizationCorporateWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateWalletOperation" ADD CONSTRAINT "CorporateWalletOperation_corporateWalletId_fkey" FOREIGN KEY ("corporateWalletId") REFERENCES "OrganizationCorporateWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateWalletOperation" ADD CONSTRAINT "CorporateWalletOperation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateWalletApproval" ADD CONSTRAINT "CorporateWalletApproval_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CorporateWalletOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityToken" ADD CONSTRAINT "PropertyIdentityToken_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyIdentityToken" ADD CONSTRAINT "PropertyIdentityToken_ownerWalletId_fkey" FOREIGN KEY ("ownerWalletId") REFERENCES "OrganizationCorporateWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTokenOperation" ADD CONSTRAINT "PropertyTokenOperation_tokenRecordId_fkey" FOREIGN KEY ("tokenRecordId") REFERENCES "PropertyIdentityToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTokenOperation" ADD CONSTRAINT "PropertyTokenOperation_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "PropertyIdentityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTokenOperation" ADD CONSTRAINT "PropertyTokenOperation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTokenEvent" ADD CONSTRAINT "PropertyTokenEvent_tokenRecordId_fkey" FOREIGN KEY ("tokenRecordId") REFERENCES "PropertyIdentityToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainReconciliationIssue" ADD CONSTRAINT "BlockchainReconciliationIssue_tokenRecordId_fkey" FOREIGN KEY ("tokenRecordId") REFERENCES "PropertyIdentityToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Operational invariants that Prisma cannot express as partial unique indexes.
CREATE UNIQUE INDEX "OrganizationCorporateWallet_one_operational_per_org_chain"
ON "OrganizationCorporateWallet"("organizationId", "chainId")
WHERE "status" IN ('VERIFIED', 'ACTIVE', 'FROZEN', 'ROTATION_PENDING');

CREATE UNIQUE INDEX "BlockchainContractRegistry_one_active_per_chain_type"
ON "BlockchainContractRegistry"("chainId", "contractType")
WHERE "active" = true;
