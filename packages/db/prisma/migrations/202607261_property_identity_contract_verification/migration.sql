ALTER TABLE "BlockchainContractRegistry"
  ADD COLUMN "registryAdminSafeAddress" TEXT,
  ADD COLUMN "bytecodeHash" TEXT,
  ADD COLUMN "deploymentBlockNumber" BIGINT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "registeredByUserId" TEXT;

CREATE INDEX "BlockchainContractRegistry_chainId_registryAdminSafeAddress_active_idx"
  ON "BlockchainContractRegistry"("chainId", "registryAdminSafeAddress", "active");
