import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ActorAuthError, validateIdempotencyKey, type ActorContext } from "@kvartal/auth";
import { assertChainWriteAllowed, buildPublicTokenPayload, deterministicTokenId, encodeRegistryOperation, normalizeAddress, readChainConfig, RegistryRpcAdapter } from "@kvartal/web3";
import { resolvePlatformSigner } from "./platform-signer.js";

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function assertOwner(actor: ActorContext) {
  if (!actor.platformRoles.includes("platform_owner")) throw new ActorAuthError("FORBIDDEN", 403, "Web3 registry control is restricted to the platform owner.");
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 2 * 1024 * 1024) throw new ActorAuthError("FORBIDDEN", 413, "The Web3 request body is too large.");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

const registryConstructorAbi = [{
  type: "constructor",
  stateMutability: "nonpayable",
  inputs: [{ name: "registryAdminWallet", type: "address" }],
}] as const;

function requiredString(body: Record<string, unknown>, field: string) {
  const value = typeof body[field] === "string" ? body[field].trim() : "";
  if (!value) throw new ActorAuthError("FORBIDDEN", 400, `${field} is required.`);
  return value;
}

function bytes32(value: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() : `0x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}


export function buildWeb3Readiness(input: {
  chainId: number;
  production: boolean;
  writesAllowed: boolean;
  activePlatformWallet: { walletAddress: string } | null;
  activeRegistryContract: { contractAddress: string; platformRegistryWalletId: string | null } | null;
  activeCorporateWalletCount: number;
  eligibleProfileCount: number;
  reconciledActiveTokenCount: number;
}) {
  const mainnetSelected = input.production && input.chainId === 56;
  const activePlatformWallet = Boolean(input.activePlatformWallet);
  const activeRegistryContract = Boolean(input.activeRegistryContract?.platformRegistryWalletId);
  const firstTokenLive = input.reconciledActiveTokenCount > 0;
  const readyForMint = input.writesAllowed
    && activePlatformWallet
    && activeRegistryContract
    && input.activeCorporateWalletCount > 0
    && input.eligibleProfileCount > 0;

  let nextAction = "FIRST_TOKEN_LIVE";
  if (!input.writesAllowed) nextAction = mainnetSelected ? "ENABLE_MAINNET_WRITES_AFTER_DEV_E2E" : "ENABLE_TESTNET_WRITES";
  else if (!activePlatformWallet) nextAction = "BIND_PLATFORM_REGISTRY_WALLET";
  else if (!activeRegistryContract) nextAction = "DEPLOY_AND_REGISTER_CONTRACT";
  else if (input.activeCorporateWalletCount === 0) nextAction = "AGENCY_CONNECTS_CORPORATE_WALLET";
  else if (input.eligibleProfileCount === 0) nextAction = "PREPARE_VERIFIED_PROPERTY";
  else if (!firstTokenLive) nextAction = "MINT_AND_RECONCILE_FIRST_TOKEN";

  return {
    mainnetSelected,
    writesAllowed: input.writesAllowed,
    activePlatformWallet,
    platformRegistryWalletAddress: input.activePlatformWallet?.walletAddress ?? null,
    activeRegistryContract,
    registryContractAddress: input.activeRegistryContract?.contractAddress ?? null,
    activeCorporateWalletCount: input.activeCorporateWalletCount,
    eligibleProfileCount: input.eligibleProfileCount,
    reconciledActiveTokenCount: input.reconciledActiveTokenCount,
    readyForMint,
    firstTokenLive,
    nextAction,
  };
}

export async function handlePropertyIdentityWeb3Route(input: { request: IncomingMessage; response: ServerResponse; url: URL; prisma: PrismaClient; actor: ActorContext; env?: NodeJS.ProcessEnv }) {
  if (!input.url.pathname.startsWith("/api/v1/platform/property-identity/web3")) return false;
  assertOwner(input.actor);
  const env = input.env ?? process.env;

  if (input.url.pathname === "/api/v1/platform/property-identity/web3" && input.request.method === "GET") {
    const [wallets, platformWallets, contracts, tokenGroups, operationGroups, tokens, operations, issues, organizations, eligibleProfiles] = await Promise.all([
      input.prisma.organizationCorporateWallet.findMany({ include: { organization: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
      input.prisma.platformRegistryWallet.findMany({ select: { id: true, platformOwnerUserId: true, chainId: true, walletAddress: true, secretResourceName: true, status: true, verifiedAt: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: "desc" } }),
      input.prisma.blockchainContractRegistry.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      input.prisma.propertyIdentityToken.groupBy({ by: ["status", "reconciliationStatus"], _count: { _all: true } }),
      input.prisma.propertyTokenOperation.groupBy({ by: ["status"], _count: { _all: true } }),
      input.prisma.propertyIdentityToken.findMany({ include: { identityProfile: true, ownerWallet: { include: { organization: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
      input.prisma.propertyTokenOperation.findMany({ include: { identityProfile: true }, orderBy: { createdAt: "desc" }, take: 100 }),
      input.prisma.blockchainReconciliationIssue.findMany({ where: { resolvedAt: null }, orderBy: { detectedAt: "desc" }, take: 100 }),
      input.prisma.organization.findMany({ where: { status: "active" }, select: { id: true, slug: true, legalName: true }, orderBy: { legalName: "asc" } }),
      input.prisma.propertyIdentityProfile.findMany({ where: { status: "VERIFIED_INTERNAL" }, select: { id: true, stableId: true, token: { select: { id: true, status: true } }, propertyObject: { select: { localizations: { where: { language: "ru" }, select: { title: true }, take: 1 } } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    const config = readChainConfig(env);
    const activeRegistryContract = contracts.find((contract) => contract.chainId === config.chainId && contract.active && contract.status === "ACTIVE") ?? null;
    const activePlatformWallet = platformWallets.find((wallet) => wallet.chainId === config.chainId && wallet.status === "ACTIVE") ?? null;
    const activeCorporateWalletCount = wallets.filter((wallet) => wallet.chainId === config.chainId && wallet.status === "ACTIVE").length;
    const reconciledActiveTokenCount = tokens.filter((token) => token.chainId === config.chainId && token.status === "ACTIVE" && token.reconciliationStatus === "IN_SYNC").length;
    const readiness = buildWeb3Readiness({
      chainId: config.chainId,
      production: config.production,
      writesAllowed: config.writesAllowed,
      activePlatformWallet: activePlatformWallet ? { walletAddress: activePlatformWallet.walletAddress } : null,
      activeRegistryContract: activeRegistryContract ? { contractAddress: activeRegistryContract.contractAddress, platformRegistryWalletId: activeRegistryContract.platformRegistryWalletId } : null,
      activeCorporateWalletCount,
      eligibleProfileCount: eligibleProfiles.length,
      reconciledActiveTokenCount,
    });
    sendJson(input.response, 200, {
      chain: config,
      readiness,
      platformWallets,
      wallets,
      contracts: contracts.map((contract) => ({ ...contract, deploymentBlockNumber: contract.deploymentBlockNumber?.toString() ?? null })), tokenGroups, operationGroups, tokens, operations, issues, organizations,
      eligibleProfiles: eligibleProfiles.map((profile) => ({ id: profile.id, stableId: profile.stableId, title: profile.propertyObject.localizations[0]?.title ?? profile.stableId, token: profile.token })),
    });
    return true;
  }

  if (input.url.pathname === "/api/v1/platform/property-identity/web3/platform-wallet" && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const config = readChainConfig(env);
    const walletAddress = normalizeAddress(requiredString(body, "walletAddress"));
    const secretResourceName = requiredString(body, "secretResourceName");
    let signer;
    try { signer = await resolvePlatformSigner({ secretResourceName, expectedAddress: walletAddress, chainId: config.chainId, rpcUrl: config.rpcUrl }); }
    catch (error) { throw new ActorAuthError("FORBIDDEN", 409, `Platform signer verification failed: ${error instanceof Error ? error.message : "PLATFORM_SIGNER_INVALID"}`); }
    const wallet = await input.prisma.platformRegistryWallet.upsert({
      where: { platformOwnerUserId_chainId: { platformOwnerUserId: input.actor.appUserId, chainId: config.chainId } },
      update: { walletAddress: signer.address, secretResourceName, status: "ACTIVE", boundByUserId: input.actor.appUserId, verifiedAt: new Date() },
      create: { platformOwnerUserId: input.actor.appUserId, chainId: config.chainId, walletAddress: signer.address, secretResourceName, status: "ACTIVE", boundByUserId: input.actor.appUserId, verifiedAt: new Date() },
      select: { id: true, chainId: true, walletAddress: true, status: true, verifiedAt: true },
    });
    await input.prisma.auditLog.create({ data: { actorUserId: input.actor.appUserId, action: "PLATFORM_REGISTRY_WALLET_BOUND", entityType: "PlatformRegistryWallet", entityId: wallet.id, after: { chainId: wallet.chainId, walletAddress: wallet.walletAddress, secretResourceName } } });
    sendJson(input.response, 201, { ok: true, wallet });
    return true;
  }

  if (input.url.pathname === "/api/v1/platform/property-identity/web3/contracts/deploy" && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const idempotencyKey = input.request.headers["idempotency-key"];
    if (!validateIdempotencyKey(idempotencyKey)) throw new ActorAuthError("IDEMPOTENCY_KEY_INVALID", 400, "A valid Idempotency-Key is required.");
    const config = readChainConfig(env);
    assertChainWriteAllowed(config, env);
    const bytecode = requiredString(body, "bytecode").toLowerCase();
    const abiHash = requiredString(body, "abiHash").toLowerCase();
    const version = requiredString(body, "version");
    const reason = requiredString(body, "reason");
    if (!/^0x[0-9a-f]+$/.test(bytecode) || bytecode.length < 100) throw new ActorAuthError("FORBIDDEN", 400, "Approved contract creation bytecode is required.");
    if (!/^0x[0-9a-f]{64}$/.test(abiHash)) throw new ActorAuthError("FORBIDDEN", 400, "abiHash must be a SHA-256 bytes32 hash.");
    if (!/^v?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new ActorAuthError("FORBIDDEN", 400, "version must use semantic versioning.");
    if (reason.length < 10) throw new ActorAuthError("FORBIDDEN", 400, "A deployment reason of at least 10 characters is required.");
    const creationBytecodeHash = `0x${createHash("sha256").update(Buffer.from(bytecode.slice(2), "hex")).digest("hex")}`;
    const allowedCreationBytecodeHash = env.PROPERTY_IDENTITY_ALLOWED_CREATION_BYTECODE_HASH?.toLowerCase();
    const allowedAbiHash = env.PROPERTY_IDENTITY_ALLOWED_ABI_HASH?.toLowerCase();
    const allowedRuntimeBytecodeHash = env.PROPERTY_IDENTITY_ALLOWED_BYTECODE_HASH?.toLowerCase();
    if (!allowedCreationBytecodeHash || !allowedAbiHash || !allowedRuntimeBytecodeHash) throw new ActorAuthError("DEPLOYMENT_PREREQUISITE_MISSING", 503, "Approved contract artifact hashes are not configured.");
    if (creationBytecodeHash !== allowedCreationBytecodeHash || abiHash !== allowedAbiHash) throw new ActorAuthError("FORBIDDEN", 409, "The deployment artifact does not match the approved contract build.");
    const platformWallet = await input.prisma.platformRegistryWallet.findFirst({ where: { platformOwnerUserId: input.actor.appUserId, chainId: config.chainId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
    if (!platformWallet) throw new ActorAuthError("FORBIDDEN", 409, "The platform registry wallet must be bound and verified first.");
    const existingVersion = await input.prisma.blockchainContractRegistry.findUnique({ where: { chainId_contractType_version: { chainId: config.chainId, contractType: "BEP721_PROPERTY_IDENTITY", version } } });
    if (existingVersion) throw new ActorAuthError("FORBIDDEN", 409, "This contract version is already registered; use recovery registration only for an unrecorded deployment.");

    let deploymentTxHash: `0x${string}`;
    let contractAddress: string;
    let receiptBlockNumber: bigint;
    try {
      const signer = await resolvePlatformSigner({ secretResourceName: platformWallet.secretResourceName, expectedAddress: platformWallet.walletAddress, chainId: config.chainId, rpcUrl: config.rpcUrl });
      deploymentTxHash = await signer.walletClient.deployContract({ abi: registryConstructorAbi, bytecode: bytecode as `0x${string}`, args: [normalizeAddress(platformWallet.walletAddress)] });
      const receipt = await signer.publicClient.waitForTransactionReceipt({ hash: deploymentTxHash, confirmations: 2 });
      if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("PLATFORM_CONTRACT_DEPLOYMENT_REVERTED");
      contractAddress = normalizeAddress(receipt.contractAddress);
      receiptBlockNumber = receipt.blockNumber;
    } catch (error) {
      throw new ActorAuthError("FORBIDDEN", 502, `Platform contract deployment failed: ${error instanceof Error ? error.message : "PLATFORM_CONTRACT_DEPLOYMENT_FAILED"}`);
    }

    let verified;
    try {
      verified = await new RegistryRpcAdapter(config.rpcUrl).verifyDeployment({ contractAddress, deploymentTxHash, registryAdminWallet: platformWallet.walletAddress });
    } catch (error) {
      throw new ActorAuthError("FORBIDDEN", 409, `The deployed contract failed mandatory on-chain verification: ${error instanceof Error ? error.message : "REGISTRY_DEPLOYMENT_VERIFICATION_FAILED"}. Recovery registration remains available after investigation.`);
    }
    if (verified.bytecodeHash.toLowerCase() !== allowedRuntimeBytecodeHash) throw new ActorAuthError("FORBIDDEN", 409, "The deployed runtime bytecode does not match the approved artifact.");

    const registered = await input.prisma.$transaction(async (tx) => {
      await tx.blockchainContractRegistry.updateMany({ where: { chainId: config.chainId, contractType: "BEP721_PROPERTY_IDENTITY", active: true }, data: { active: false, status: "SUPERSEDED" } });
      const contract = await tx.blockchainContractRegistry.create({ data: {
        chainId: config.chainId,
        contractType: "BEP721_PROPERTY_IDENTITY",
        contractAddress,
        registryAdminSafeAddress: null,
        platformRegistryWalletId: platformWallet.id,
        version,
        abiHash,
        bytecodeHash: verified.bytecodeHash,
        deploymentTxHash,
        deploymentBlockNumber: verified.deploymentBlockNumber,
        explorerUrl: `${config.explorerUrl}/address/${contractAddress}`,
        status: "ACTIVE",
        active: true,
        verifiedAt: new Date(),
        registeredByUserId: input.actor.appUserId,
      } });
      await tx.auditLog.create({ data: { actorUserId: input.actor.appUserId, action: "PROPERTY_IDENTITY_WEB3_CONTRACT_DEPLOYED", entityType: "BlockchainContractRegistry", entityId: contract.id, after: { chainId: config.chainId, contractAddress, registryAdminWallet: platformWallet.walletAddress, deploymentTxHash, receiptBlockNumber: receiptBlockNumber.toString(), abiHash, creationBytecodeHash, runtimeBytecodeHash: verified.bytecodeHash, version, reason, idempotencyKey } } });
      return contract;
    });
    sendJson(input.response, 201, { ok: true, contract: { ...registered, deploymentBlockNumber: registered.deploymentBlockNumber?.toString() ?? null }, registryWallet: platformWallet.walletAddress });
    return true;
  }

  if (input.url.pathname === "/api/v1/platform/property-identity/web3/contracts/register" && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const config = readChainConfig(env);
    assertChainWriteAllowed(config, env);
    const contractAddress = normalizeAddress(requiredString(body, "contractAddress"));
    const deploymentTxHash = requiredString(body, "deploymentTxHash").toLowerCase();
    const abiHash = requiredString(body, "abiHash").toLowerCase();
    const version = requiredString(body, "version");
    const reason = requiredString(body, "reason");
    const platformWallet = await input.prisma.platformRegistryWallet.findFirst({ where: { platformOwnerUserId: input.actor.appUserId, chainId: config.chainId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
    if (!platformWallet) throw new ActorAuthError("FORBIDDEN", 409, "The platform registry wallet must be bound and verified first.");
    if (!/^0x[0-9a-f]{64}$/.test(deploymentTxHash)) throw new ActorAuthError("FORBIDDEN", 400, "deploymentTxHash must be a transaction hash.");
    if (!/^0x[0-9a-f]{64}$/.test(abiHash)) throw new ActorAuthError("FORBIDDEN", 400, "abiHash must be a SHA-256 bytes32 hash.");
    if (!/^v?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new ActorAuthError("FORBIDDEN", 400, "version must use semantic versioning.");
    if (reason.length < 10) throw new ActorAuthError("FORBIDDEN", 400, "A registration reason of at least 10 characters is required.");

    let verified;
    try {
      verified = await new RegistryRpcAdapter(config.rpcUrl).verifyDeployment({ contractAddress, deploymentTxHash: deploymentTxHash as `0x${string}`, registryAdminWallet: platformWallet.walletAddress });
    } catch (error) {
      const code = error instanceof Error ? error.message : "REGISTRY_DEPLOYMENT_VERIFICATION_FAILED";
      throw new ActorAuthError("FORBIDDEN", 409, `On-chain registry verification failed: ${code}`);
    }
    const allowedAbiHash = env.PROPERTY_IDENTITY_ALLOWED_ABI_HASH?.toLowerCase();
    const allowedBytecodeHash = env.PROPERTY_IDENTITY_ALLOWED_BYTECODE_HASH?.toLowerCase();
    if (!allowedAbiHash || !allowedBytecodeHash) throw new ActorAuthError("DEPLOYMENT_PREREQUISITE_MISSING", 503, "Approved contract artifact hashes are not configured.");
    if (abiHash !== allowedAbiHash || verified.bytecodeHash.toLowerCase() !== allowedBytecodeHash) throw new ActorAuthError("FORBIDDEN", 409, "The deployed contract does not match the approved build artifact.");

    const existingVersion = await input.prisma.blockchainContractRegistry.findUnique({
      where: { chainId_contractType_version: { chainId: config.chainId, contractType: "BEP721_PROPERTY_IDENTITY", version } },
    });
    if (existingVersion && existingVersion.contractAddress.toLowerCase() !== contractAddress.toLowerCase()) throw new ActorAuthError("FORBIDDEN", 409, "This contract version is already registered with another address.");

    const registered = await input.prisma.$transaction(async (tx) => {
      await tx.blockchainContractRegistry.updateMany({
        where: { chainId: config.chainId, contractType: "BEP721_PROPERTY_IDENTITY", active: true },
        data: { active: false, status: "SUPERSEDED" },
      });
      const contract = existingVersion
        ? await tx.blockchainContractRegistry.update({
            where: { id: existingVersion.id },
            data: { contractAddress, registryAdminSafeAddress: null, platformRegistryWalletId: platformWallet.id, abiHash, bytecodeHash: verified.bytecodeHash, deploymentTxHash, deploymentBlockNumber: verified.deploymentBlockNumber, explorerUrl: `${config.explorerUrl}/address/${contractAddress}`, status: "ACTIVE", active: true, verifiedAt: new Date(), registeredByUserId: input.actor.appUserId },
          })
        : await tx.blockchainContractRegistry.create({
            data: { chainId: config.chainId, contractType: "BEP721_PROPERTY_IDENTITY", contractAddress, registryAdminSafeAddress: null, platformRegistryWalletId: platformWallet.id, version, abiHash, bytecodeHash: verified.bytecodeHash, deploymentTxHash, deploymentBlockNumber: verified.deploymentBlockNumber, explorerUrl: `${config.explorerUrl}/address/${contractAddress}`, status: "ACTIVE", active: true, verifiedAt: new Date(), registeredByUserId: input.actor.appUserId },
          });
      await tx.auditLog.create({ data: { actorUserId: input.actor.appUserId, action: "PROPERTY_IDENTITY_WEB3_CONTRACT_REGISTERED", entityType: "BlockchainContractRegistry", entityId: contract.id, after: { chainId: config.chainId, contractAddress, registryAdminWallet: platformWallet.walletAddress, deploymentTxHash, abiHash, bytecodeHash: verified.bytecodeHash, version, reason } } });
      return contract;
    });
    sendJson(input.response, 201, { ok: true, contract: { ...registered, deploymentBlockNumber: registered.deploymentBlockNumber?.toString() ?? null }, verified: { ...verified, deploymentBlockNumber: verified.deploymentBlockNumber.toString() }, registryWallet: platformWallet.walletAddress });
    return true;
  }

  if (input.url.pathname === "/api/v1/platform/property-identity/web3/token-operations" && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const idempotencyKey = input.request.headers["idempotency-key"];
    if (!validateIdempotencyKey(idempotencyKey)) throw new ActorAuthError("IDEMPOTENCY_KEY_INVALID", 400, "A valid Idempotency-Key is required.");
    const identityProfileId = requiredString(body, "identityProfileId");
    const operationType = requiredString(body, "operationType").toUpperCase();
    if (!["MINT", "UPDATE_HASHES", "SUSPEND", "UNSUSPEND", "REVOKE"].includes(operationType)) throw new ActorAuthError("FORBIDDEN", 400, "Unsupported token operation.");
    const profile = await input.prisma.propertyIdentityProfile.findUnique({
      where: { id: identityProfileId },
      include: { canonicalVersions: { where: { isCurrent: true }, orderBy: { versionNumber: "desc" }, take: 1 }, claims: { where: { status: "ACTIVE" } }, originatorRecords: { where: { status: "RECORDED" }, orderBy: { createdAt: "asc" }, take: 1 }, representationRights: { where: { status: { in: ["ATTESTED", "VERIFIED"] }, corporateWallet: { status: "ACTIVE" } }, include: { corporateWallet: true } }, token: true },
    });
    if (!profile || profile.status !== "VERIFIED_INTERNAL") throw new ActorAuthError("FORBIDDEN", 409, "A verified identity profile is required.");
    const canonical = profile.canonicalVersions[0];
    const originator = profile.originatorRecords[0];
    if (!canonical || !originator) throw new ActorAuthError("FORBIDDEN", 409, "Canonical version and originator are required.");
    const config = readChainConfig(env);
    assertChainWriteAllowed(config, env);
    const contract = await input.prisma.blockchainContractRegistry.findFirst({ where: { chainId: config.chainId, contractType: "BEP721_PROPERTY_IDENTITY", active: true, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
    if (!contract) throw new ActorAuthError("FORBIDDEN", 409, "An active registry contract is not configured.");
    if (!contract.platformRegistryWalletId) throw new ActorAuthError("FORBIDDEN", 409, "The active registry contract has no verified platform registry wallet.");
    const platformWallet = await input.prisma.platformRegistryWallet.findUnique({ where: { id: contract.platformRegistryWalletId } });
    if (!platformWallet || platformWallet.status !== "ACTIVE") throw new ActorAuthError("FORBIDDEN", 409, "The platform registry wallet is not active.");
    if (profile.representationRights.length === 0) throw new ActorAuthError("FORBIDDEN", 409, "At least one attested agency representation with an active corporate wallet is required.");
    const tokenId = profile.token?.tokenId.toFixed(0) ?? deterministicTokenId(profile.stableId).toString();
    const publicPayload = buildPublicTokenPayload({ stablePropertyIdentityId: profile.stableId, canonicalVersionHash: bytes32(canonical.snapshotHash), evidencePackageHash: bytes32(JSON.stringify(profile.claims.map((claim) => ({ id: claim.id, scheme: claim.scheme, status: claim.status })))) });
    const targetAddress = platformWallet.walletAddress;
    const operationPayload: Record<string, unknown> = { tokenId, to: targetAddress, ...publicPayload, uri: typeof body.tokenUri === "string" ? body.tokenUri : "" };
    const encodedCall = encodeRegistryOperation(operationType as "MINT" | "UPDATE_HASHES" | "SUSPEND" | "UNSUSPEND" | "REVOKE", operationPayload);
    const created = await input.prisma.$transaction(async (tx) => {
      let tokenRecordId = profile.token?.id;
      if (operationType === "MINT") {
        if (profile.token && profile.token.status !== "PENDING") throw new ActorAuthError("FORBIDDEN", 409, "The identity already has a token.");
        const token = profile.token ?? await tx.propertyIdentityToken.create({ data: { identityProfileId: profile.id, tokenId: new Prisma.Decimal(tokenId), chainId: config.chainId, contractAddress: contract.contractAddress, platformRegistryWalletId: platformWallet.id, ownerAddress: platformWallet.walletAddress, status: "PENDING", reconciliationStatus: "PENDING", tokenUri: String(operationPayload.uri) || null } });
        tokenRecordId = token.id;
      } else if (!profile.token) throw new ActorAuthError("FORBIDDEN", 409, "The identity token does not exist.");
      return tx.propertyTokenOperation.create({ data: { tokenRecordId, identityProfileId: profile.id, operationType, status: "PENDING_PLATFORM_SIGNER", payloadJson: { chainId: config.chainId, contractAddress: contract.contractAddress, registryAdminWallet: platformWallet.walletAddress, targetAddress, encodedCall, reason: typeof body.reason === "string" ? body.reason : null }, idempotencyKey, requestedByUserId: input.actor.appUserId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    });
    sendJson(input.response, 202, { ok: true, operation: created, execution: "PLATFORM_SIGNER_REQUIRED", chainWritePerformed: false });
    return true;
  }

  const executeSignerMatch = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/web3\/token-operations\/([^/]+)\/execute-platform-signer$/);
  if (executeSignerMatch && input.request.method === "POST") {
    const operationId = decodeURIComponent(executeSignerMatch[1]);
    const operation = await input.prisma.propertyTokenOperation.findUnique({ where: { id: operationId }, include: { tokenRecord: { include: { platformRegistryWallet: true } } } });
    if (!operation?.tokenRecord?.platformRegistryWallet) throw new ActorAuthError("FORBIDDEN", 404, "A platform-signer token operation was not found.");
    const tokenRecord = operation.tokenRecord;
    if (!(["PENDING_PLATFORM_SIGNER", "FAILED_RETRYABLE"] as string[]).includes(operation.status)) throw new ActorAuthError("FORBIDDEN", 409, "The operation is not waiting for the platform signer.");
    const payload = operation.payloadJson && typeof operation.payloadJson === "object" && !Array.isArray(operation.payloadJson) ? operation.payloadJson as Record<string, unknown> : {};
    const contractAddress = normalizeAddress(String(payload.contractAddress ?? ""));
    const encodedCall = String(payload.encodedCall ?? "").toLowerCase();
    if (!/^0x[0-9a-f]+$/.test(encodedCall)) throw new ActorAuthError("FORBIDDEN", 409, "The queued contract call is invalid.");
    const config = readChainConfig({ ...env, PROPERTY_IDENTITY_CHAIN_ID: String(operation.tokenRecord.chainId) });
    assertChainWriteAllowed(config, env);
    const registryWallet = operation.tokenRecord.platformRegistryWallet;
    if (registryWallet.status !== "ACTIVE") throw new ActorAuthError("FORBIDDEN", 409, "The platform registry wallet is not active.");
    if (operation.expiresAt && operation.expiresAt <= new Date()) throw new ActorAuthError("FORBIDDEN", 409, "The queued operation has expired and must be replaced.");
    if (normalizeAddress(String(payload.registryAdminWallet ?? "")) !== normalizeAddress(registryWallet.walletAddress)) throw new ActorAuthError("FORBIDDEN", 409, "The queued signer wallet does not match the active platform wallet.");
    const registeredContract = await input.prisma.blockchainContractRegistry.findFirst({ where: { chainId: config.chainId, contractAddress, contractType: "BEP721_PROPERTY_IDENTITY", active: true, status: "ACTIVE", platformRegistryWalletId: registryWallet.id } });
    if (!registeredContract) throw new ActorAuthError("FORBIDDEN", 409, "The queued call does not target the active verified registry contract.");
    const claimed = await input.prisma.propertyTokenOperation.updateMany({ where: { id: operation.id, status: { in: ["PENDING_PLATFORM_SIGNER", "FAILED_RETRYABLE"] } }, data: { status: "SUBMITTED" } });
    if (claimed.count !== 1) throw new ActorAuthError("FORBIDDEN", 409, "The operation was already claimed for execution.");
    let submittedHash: `0x${string}` | null = null;
    try {
      const signer = await resolvePlatformSigner({ secretResourceName: registryWallet.secretResourceName, expectedAddress: registryWallet.walletAddress, chainId: config.chainId, rpcUrl: config.rpcUrl });
      const chainTxHash = await signer.walletClient.sendTransaction({ to: contractAddress, data: encodedCall as `0x${string}`, value: 0n });
      submittedHash = chainTxHash;
      // Persist the transaction hash before waiting. A timeout or process restart must
      // never make the same registry mutation eligible for a duplicate submission.
      await input.prisma.$transaction([
        input.prisma.propertyTokenOperation.update({ where: { id: operation.id }, data: { status: "SUBMITTED", chainTxHash } }),
        input.prisma.propertyIdentityToken.update({ where: { id: tokenRecord.id }, data: { lastTxHash: chainTxHash, reconciliationStatus: "PENDING" } }),
      ]);
      const receipt = await signer.publicClient.waitForTransactionReceipt({ hash: chainTxHash, confirmations: 2 });
      if (receipt.status !== "success") {
        await input.prisma.propertyTokenOperation.update({ where: { id: operation.id }, data: { status: "FAILED_FINAL" } });
        throw new Error("PLATFORM_SIGNER_TRANSACTION_REVERTED");
      }
      await input.prisma.$transaction(async (tx) => {
        const registryLogs = receipt.logs.filter((log) => log.address.toLowerCase() === contractAddress.toLowerCase() && log.logIndex !== null);
        if (registryLogs.length) {
          await tx.propertyTokenEvent.createMany({
            data: registryLogs.map((log) => ({
              tokenRecordId: tokenRecord.id,
              eventName: "REGISTRY_EVENT",
              chainId: config.chainId,
              txHash: chainTxHash,
              logIndex: log.logIndex!,
              blockNumber: receipt.blockNumber,
              payloadJson: { operationType: operation.operationType, topics: log.topics, data: log.data },
            })),
            skipDuplicates: true,
          });
        }
        await tx.auditLog.create({ data: { actorUserId: input.actor.appUserId, action: "PROPERTY_IDENTITY_PLATFORM_SIGNER_EXECUTED", entityType: "PropertyTokenOperation", entityId: operation.id, after: { chainId: config.chainId, contractAddress, chainTxHash, blockNumber: receipt.blockNumber.toString(), logIndexes: registryLogs.map((log) => log.logIndex) } } });
      });
      sendJson(input.response, 200, { ok: true, status: "SUBMITTED", chainTxHash, blockNumber: receipt.blockNumber.toString(), reconciliationRequired: true });
      return true;
    } catch (error) {
      if (!submittedHash) await input.prisma.propertyTokenOperation.update({ where: { id: operation.id }, data: { status: "FAILED_RETRYABLE" } });
      throw new ActorAuthError("FORBIDDEN", 502, `Platform signer execution failed: ${error instanceof Error ? error.message : "PLATFORM_SIGNER_EXECUTION_FAILED"}`);
    }
  }

  const reconcileMatch = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/web3\/tokens\/([^/]+)\/reconcile$/);
  if (reconcileMatch && input.request.method === "POST") {
    const tokenId = decodeURIComponent(reconcileMatch[1]);
    const token = await input.prisma.propertyIdentityToken.findUnique({ where: { id: tokenId }, include: { operations: { where: { status: "SUBMITTED", operationType: { in: ["MINT", "UPDATE_HASHES", "SUSPEND", "UNSUSPEND", "REVOKE"] } }, orderBy: { updatedAt: "desc" }, take: 1 } } });
    if (!token) throw new ActorAuthError("FORBIDDEN", 404, "Identity token was not found.");
    const config = readChainConfig({ ...env, PROPERTY_IDENTITY_CHAIN_ID: String(token.chainId) });
    const registry = new RegistryRpcAdapter(config.rpcUrl);
    let chain;
    try { chain = await registry.readToken(token.contractAddress, BigInt(token.tokenId.toFixed(0))); }
    catch { await input.prisma.propertyIdentityToken.update({ where: { id: token.id }, data: { reconciliationStatus: "RPC_UNAVAILABLE", lastReconciledAt: new Date() } }); throw new ActorAuthError("FORBIDDEN", 503, "Blockchain RPC is unavailable; no database state was promoted."); }
    const operation = token.operations[0];
    const expectedOwner = token.ownerAddress.toLowerCase();
    const statusMap = { 1: "ACTIVE", 2: "SUSPENDED", 3: "REVOKED", 4: "SUPERSEDED" } as const;
    const chainStatus = statusMap[chain.status as keyof typeof statusMap];
    const mismatch = chain.owner.toLowerCase() !== expectedOwner || !chainStatus;
    if (mismatch) {
      await input.prisma.$transaction(async (tx) => {
        await tx.propertyIdentityToken.update({ where: { id: token.id }, data: { reconciliationStatus: "STATE_MISMATCH", lastReconciledAt: new Date() } });
        await tx.blockchainReconciliationIssue.create({ data: { tokenRecordId: token.id, issueType: "TOKEN_STATE_MISMATCH", status: "OPEN", publicStatus: "VERIFICATION_PENDING", detailsRedacted: { expectedOwner, actualOwner: chain.owner, chainStatus: chain.status } } });
      });
      sendJson(input.response, 409, { ok: false, reconciliationStatus: "STATE_MISMATCH" });
      return true;
    }
    const rightsToAttest = chainStatus === "ACTIVE" ? await input.prisma.propertyRepresentationRight.findMany({
      where: { identityProfileId: token.identityProfileId, status: { in: ["ATTESTED", "VERIFIED"] }, evidenceHash: { not: null }, corporateWallet: { status: "ACTIVE" } },
      include: { corporateWallet: true },
    }) : [];
    await input.prisma.$transaction(async (tx) => {
      await tx.propertyIdentityToken.update({ where: { id: token.id }, data: { ownerAddress: chain.owner, status: chainStatus, reconciliationStatus: "IN_SYNC", lastReconciledAt: new Date(), ...(operation?.operationType === "MINT" ? { issuedAt: new Date() } : {}), ...(chainStatus === "SUSPENDED" ? { suspendedAt: new Date() } : {}), ...(chainStatus === "REVOKED" ? { revokedAt: new Date() } : {}) } });
      if (operation) {
        await tx.propertyTokenOperation.update({ where: { id: operation.id }, data: { status: "CONFIRMED" } });
      }
      for (const right of rightsToAttest) {
        if (!right.corporateWallet || !right.evidenceHash) continue;
        const validFrom = Math.floor((right.validFrom ?? right.attestedAt ?? right.createdAt).getTime() / 1000);
        const validUntil = right.validUntil ? Math.floor(right.validUntil.getTime() / 1000) : 0;
        const encodedCall = encodeRegistryOperation("ATTEST_REPRESENTATION", { tokenId: token.tokenId.toFixed(0), agencyWallet: right.corporateWallet.walletAddress, evidenceHash: bytes32(right.evidenceHash), validFrom, validUntil });
        await tx.propertyTokenRepresentation.upsert({
          where: { tokenRecordId_representationRightId: { tokenRecordId: token.id, representationRightId: right.id } },
          update: { corporateWalletId: right.corporateWallet.id, walletAddress: right.corporateWallet.walletAddress, evidenceHash: bytes32(right.evidenceHash), status: "PENDING", validFrom: new Date(validFrom * 1000), validUntil: validUntil ? new Date(validUntil * 1000) : null },
          create: { tokenRecordId: token.id, identityProfileId: token.identityProfileId, representationRightId: right.id, corporateWalletId: right.corporateWallet.id, walletAddress: right.corporateWallet.walletAddress, evidenceHash: bytes32(right.evidenceHash), status: "PENDING", validFrom: new Date(validFrom * 1000), validUntil: validUntil ? new Date(validUntil * 1000) : null },
        });
        await tx.propertyTokenOperation.upsert({
          where: { idempotencyKey: `representation-attest:${token.id}:${right.id}` },
          update: {},
          create: { tokenRecordId: token.id, identityProfileId: token.identityProfileId, operationType: "ATTEST_REPRESENTATION", status: "PENDING_PLATFORM_SIGNER", payloadJson: { chainId: token.chainId, contractAddress: token.contractAddress, registryAdminWallet: token.ownerAddress, representationRightId: right.id, agencyWallet: right.corporateWallet.walletAddress, evidenceHash: bytes32(right.evidenceHash), validFrom, validUntil, encodedCall }, idempotencyKey: `representation-attest:${token.id}:${right.id}`, requestedByUserId: input.actor.appUserId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
      }
      await tx.blockchainReconciliationIssue.updateMany({ where: { tokenRecordId: token.id, resolvedAt: null }, data: { status: "RESOLVED", resolvedAt: new Date(), publicStatus: "VERIFIED" } });
      await tx.blockchainReconciliationCheckpoint.upsert({ where: { chainId_contractAddress: { chainId: token.chainId, contractAddress: token.contractAddress } }, update: { lastBlockNumber: chain.blockNumber, status: "IN_SYNC", lastRunAt: new Date(), errorCode: null }, create: { chainId: token.chainId, contractAddress: token.contractAddress, lastBlockNumber: chain.blockNumber, status: "IN_SYNC", lastRunAt: new Date() } });
    });

    const representationOperations = await input.prisma.propertyTokenOperation.findMany({
      where: { tokenRecordId: token.id, status: "SUBMITTED", operationType: { in: ["ATTEST_REPRESENTATION", "SUSPEND_REPRESENTATION", "REACTIVATE_REPRESENTATION", "REVOKE_REPRESENTATION"] } },
      orderBy: { updatedAt: "asc" },
    });
    let representationMismatch = false;
    for (const representationOperation of representationOperations) {
      const representationPayload = representationOperation.payloadJson && typeof representationOperation.payloadJson === "object" && !Array.isArray(representationOperation.payloadJson) ? representationOperation.payloadJson as Record<string, unknown> : {};
      const representationRightId = typeof representationPayload.representationRightId === "string" ? representationPayload.representationRightId : "";
      const agencyWallet = normalizeAddress(String(representationPayload.agencyWallet ?? ""));
      const expectedRepresentationStatus = representationOperation.operationType === "SUSPEND_REPRESENTATION" ? 2 : representationOperation.operationType === "REVOKE_REPRESENTATION" ? 3 : 1;
      const onChain = await registry.readRepresentation(token.contractAddress, BigInt(token.tokenId.toFixed(0)), agencyWallet);
      const expectedEvidenceHash = String(representationPayload.evidenceHash ?? "").toLowerCase();
      const matches = onChain.status === expectedRepresentationStatus && (representationOperation.operationType !== "ATTEST_REPRESENTATION" || onChain.evidenceHash.toLowerCase() === expectedEvidenceHash);
      if (!matches || !representationRightId) {
        representationMismatch = true;
        const existingIssue = await input.prisma.blockchainReconciliationIssue.findFirst({ where: { tokenRecordId: token.id, issueType: "REPRESENTATION_STATE_MISMATCH", status: "OPEN", detailsRedacted: { path: ["operationId"], equals: representationOperation.id } } });
        if (!existingIssue) await input.prisma.blockchainReconciliationIssue.create({ data: { tokenRecordId: token.id, issueType: "REPRESENTATION_STATE_MISMATCH", status: "OPEN", publicStatus: "VERIFICATION_PENDING", detailsRedacted: { operationId: representationOperation.id, representationRightId, agencyWallet, expectedStatus: expectedRepresentationStatus, actualStatus: onChain.status } } });
        continue;
      }
      await input.prisma.$transaction([
        input.prisma.propertyTokenOperation.update({ where: { id: representationOperation.id }, data: { status: "CONFIRMED" } }),
        input.prisma.propertyTokenRepresentation.update({ where: { tokenRecordId_representationRightId: { tokenRecordId: token.id, representationRightId } }, data: { status: expectedRepresentationStatus === 1 ? "ACTIVE" : expectedRepresentationStatus === 2 ? "SUSPENDED" : "REVOKED", lastTxHash: representationOperation.chainTxHash, lastReconciledAt: new Date() } }),
      ]);
    }
    sendJson(input.response, 200, { ok: true, reconciliationStatus: representationMismatch ? "REPRESENTATION_MISMATCH" : "IN_SYNC", ownerAddress: chain.owner, status: chainStatus, blockNumber: chain.blockNumber.toString(), representationsReconciled: representationOperations.length });
    return true;
  }

  return false;
}
