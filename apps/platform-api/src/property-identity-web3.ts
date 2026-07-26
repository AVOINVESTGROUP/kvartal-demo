import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Prisma, type PrismaClient } from "@prisma/client";
import SafeApiKit from "@safe-global/api-kit";
import { ActorAuthError, validateIdempotencyKey, type ActorContext } from "@kvartal/auth";
import { buildPublicTokenPayload, corporateWalletChallenge, deterministicTokenId, encodeRegistryOperation, normalizeAddress, readChainConfig, RegistryRpcAdapter, SafeRpcAdapter, type SupportedChainId } from "@kvartal/web3";

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function assertOwner(actor: ActorContext) {
  if (!actor.platformRoles.includes("platform_owner")) throw new ActorAuthError("FORBIDDEN", 403, "Web3 registry control is restricted to the platform owner.");
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

function requiredString(body: Record<string, unknown>, field: string) {
  const value = typeof body[field] === "string" ? body[field].trim() : "";
  if (!value) throw new ActorAuthError("FORBIDDEN", 400, `${field} is required.`);
  return value;
}

function bytes32(value: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() : `0x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function safeApiKit(env: NodeJS.ProcessEnv, chainId: number) {
  const apiKey = env.SAFE_API_KEY?.trim();
  const txServiceUrl = env.SAFE_TRANSACTION_SERVICE_URL?.trim();
  if (!apiKey && !txServiceUrl) throw new ActorAuthError("FORBIDDEN", 503, "Safe Transaction Service is not configured.");
  return new SafeApiKit({ chainId: BigInt(chainId), ...(apiKey ? { apiKey } : {}), ...(txServiceUrl ? { txServiceUrl } : {}) });
}

export async function handlePropertyIdentityWeb3Route(input: { request: IncomingMessage; response: ServerResponse; url: URL; prisma: PrismaClient; actor: ActorContext; env?: NodeJS.ProcessEnv }) {
  if (!input.url.pathname.startsWith("/api/v1/platform/property-identity/web3")) return false;
  assertOwner(input.actor);
  const env = input.env ?? process.env;

  if (input.url.pathname === "/api/v1/platform/property-identity/web3" && input.request.method === "GET") {
    const [wallets, contracts, tokenGroups, operationGroups, tokens, operations, issues, organizations, eligibleProfiles] = await Promise.all([
      input.prisma.organizationCorporateWallet.findMany({ include: { organization: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
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
    sendJson(input.response, 200, {
      chain: config,
      wallets: wallets.map((wallet) => ({
        ...wallet,
        challenge: wallet.status === "CHALLENGE_ISSUED" && wallet.lastChallengeNonce && wallet.lastChallengeExpiresAt && wallet.lastChallengeExpiresAt.getTime() > Date.now()
          ? corporateWalletChallenge({ chainId: wallet.chainId as SupportedChainId, safeAddress: wallet.walletAddress, organizationId: wallet.organizationId, nonce: wallet.lastChallengeNonce, expiresAt: wallet.lastChallengeExpiresAt })
          : null,
      })),
      contracts: contracts.map((contract) => ({ ...contract, deploymentBlockNumber: contract.deploymentBlockNumber?.toString() ?? null })), tokenGroups, operationGroups, tokens, operations, issues, organizations,
      eligibleProfiles: eligibleProfiles.map((profile) => ({ id: profile.id, stableId: profile.stableId, title: profile.propertyObject.localizations[0]?.title ?? profile.stableId, token: profile.token })),
    });
    return true;
  }

  if (input.url.pathname === "/api/v1/platform/property-identity/web3/contracts/register" && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const config = readChainConfig(env);
    const contractAddress = normalizeAddress(requiredString(body, "contractAddress"));
    const registryAdminSafeAddress = normalizeAddress(requiredString(body, "registryAdminSafeAddress"));
    const deploymentTxHash = requiredString(body, "deploymentTxHash").toLowerCase();
    const abiHash = requiredString(body, "abiHash").toLowerCase();
    const version = requiredString(body, "version");
    const reason = requiredString(body, "reason");
    if (!/^0x[0-9a-f]{64}$/.test(deploymentTxHash)) throw new ActorAuthError("FORBIDDEN", 400, "deploymentTxHash must be a transaction hash.");
    if (!/^0x[0-9a-f]{64}$/.test(abiHash)) throw new ActorAuthError("FORBIDDEN", 400, "abiHash must be a SHA-256 bytes32 hash.");
    if (!/^v?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new ActorAuthError("FORBIDDEN", 400, "version must use semantic versioning.");
    if (reason.length < 10) throw new ActorAuthError("FORBIDDEN", 400, "A registration reason of at least 10 characters is required.");

    let safe;
    let verified;
    try {
      [safe, verified] = await Promise.all([
        new SafeRpcAdapter(config.rpcUrl).readSafe(registryAdminSafeAddress),
        new RegistryRpcAdapter(config.rpcUrl).verifyDeployment({ contractAddress, deploymentTxHash: deploymentTxHash as `0x${string}`, registryAdminSafe: registryAdminSafeAddress }),
      ]);
    } catch (error) {
      const code = error instanceof Error ? error.message : "REGISTRY_DEPLOYMENT_VERIFICATION_FAILED";
      throw new ActorAuthError("FORBIDDEN", 409, `On-chain registry verification failed: ${code}`);
    }
    if (safe.owners.length < 2 || safe.threshold < 2) throw new ActorAuthError("FORBIDDEN", 409, "Registry/Admin Safe must have at least two owners and threshold 2.");

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
            data: { contractAddress, registryAdminSafeAddress, abiHash, bytecodeHash: verified.bytecodeHash, deploymentTxHash, deploymentBlockNumber: verified.deploymentBlockNumber, explorerUrl: `${config.explorerUrl}/address/${contractAddress}`, status: "ACTIVE", active: true, verifiedAt: new Date(), registeredByUserId: input.actor.appUserId },
          })
        : await tx.blockchainContractRegistry.create({
            data: { chainId: config.chainId, contractType: "BEP721_PROPERTY_IDENTITY", contractAddress, registryAdminSafeAddress, version, abiHash, bytecodeHash: verified.bytecodeHash, deploymentTxHash, deploymentBlockNumber: verified.deploymentBlockNumber, explorerUrl: `${config.explorerUrl}/address/${contractAddress}`, status: "ACTIVE", active: true, verifiedAt: new Date(), registeredByUserId: input.actor.appUserId },
          });
      await tx.auditLog.create({ data: { actorUserId: input.actor.appUserId, action: "PROPERTY_IDENTITY_WEB3_CONTRACT_REGISTERED", entityType: "BlockchainContractRegistry", entityId: contract.id, after: { chainId: config.chainId, contractAddress, registryAdminSafeAddress, deploymentTxHash, abiHash, bytecodeHash: verified.bytecodeHash, version, safeThreshold: safe.threshold, safeOwnerCount: safe.owners.length, reason } } });
      return contract;
    });
    sendJson(input.response, 201, { ok: true, contract: { ...registered, deploymentBlockNumber: registered.deploymentBlockNumber?.toString() ?? null }, verified: { ...verified, deploymentBlockNumber: verified.deploymentBlockNumber.toString() }, safe });
    return true;
  }

  if (input.url.pathname === "/api/v1/platform/property-identity/web3/corporate-wallets/challenge" && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const organizationId = requiredString(body, "organizationId");
    const walletAddress = requiredString(body, "walletAddress");
    const config = readChainConfig({ ...env, PROPERTY_IDENTITY_CHAIN_ID: String(body.chainId ?? env.PROPERTY_IDENTITY_CHAIN_ID ?? 97) });
    const organization = await input.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new ActorAuthError("FORBIDDEN", 404, "Organization was not found.");
    const nonce = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const challenge = corporateWalletChallenge({ chainId: config.chainId, safeAddress: walletAddress, organizationId, nonce, expiresAt });
    const wallet = await input.prisma.organizationCorporateWallet.upsert({
      where: { organizationId_chainId_walletAddress: { organizationId, chainId: config.chainId, walletAddress: challenge.typedData.message.safeAddress } },
      update: { status: "CHALLENGE_ISSUED", lastChallengeNonce: nonce, lastChallengeExpiresAt: expiresAt },
      create: { organizationId, chainId: config.chainId, walletAddress: challenge.typedData.message.safeAddress, status: "CHALLENGE_ISSUED", lastChallengeNonce: nonce, lastChallengeExpiresAt: expiresAt },
    });
    sendJson(input.response, 201, { ok: true, walletId: wallet.id, expiresAt, typedData: challenge.typedData, messageHash: challenge.messageHash });
    return true;
  }

  if (input.url.pathname === "/api/v1/platform/property-identity/web3/corporate-wallets/verify" && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const walletId = requiredString(body, "walletId");
    const signature = requiredString(body, "signature") as `0x${string}`;
    const wallet = await input.prisma.organizationCorporateWallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.status !== "CHALLENGE_ISSUED" || !wallet.lastChallengeNonce || !wallet.lastChallengeExpiresAt) throw new ActorAuthError("FORBIDDEN", 409, "An active wallet challenge is required.");
    if (wallet.lastChallengeExpiresAt.getTime() <= Date.now()) throw new ActorAuthError("FORBIDDEN", 409, "The wallet challenge has expired.");
    const config = readChainConfig({ ...env, PROPERTY_IDENTITY_CHAIN_ID: String(wallet.chainId) });
    const challenge = corporateWalletChallenge({ chainId: wallet.chainId as SupportedChainId, safeAddress: wallet.walletAddress, organizationId: wallet.organizationId, nonce: wallet.lastChallengeNonce, expiresAt: wallet.lastChallengeExpiresAt });
    const adapter = new SafeRpcAdapter(config.rpcUrl);
    const [valid, safe] = await Promise.all([adapter.verifyEip1271(wallet.walletAddress, challenge.messageHash, signature), adapter.readSafe(wallet.walletAddress)]);
    if (!valid) throw new ActorAuthError("FORBIDDEN", 409, "The Safe EIP-1271 signature is invalid.");
    const status = safe.threshold >= 2 && safe.owners.length >= 2 ? "ACTIVE" : "VERIFIED";
    const updated = await input.prisma.$transaction(async (tx) => {
      await tx.corporateWalletSigner.deleteMany({ where: { corporateWalletId: wallet.id } });
      await tx.corporateWalletSigner.createMany({ data: safe.owners.map((signerAddress) => ({ corporateWalletId: wallet.id, signerAddress, role: "SAFE_OWNER" })) });
      const policy = await tx.corporateWalletPolicy.findFirst({ where: { corporateWalletId: wallet.id, active: true } });
      if (!policy) await tx.corporateWalletPolicy.create({ data: { corporateWalletId: wallet.id, minThreshold: 2, makerCheckerRequired: true, highRiskOperationTypes: ["ROTATE", "FREEZE", "RECOVERY"] } });
      return tx.organizationCorporateWallet.update({ where: { id: wallet.id }, data: { status, threshold: safe.threshold, ownerCount: safe.owners.length, ownersHash: bytes32([...safe.owners].sort().join(":")), safeVersion: safe.version, lastOnChainSyncAt: new Date(), lastChallengeNonce: null, lastChallengeExpiresAt: null } });
    });
    sendJson(input.response, 200, { ok: true, wallet: updated, productionReady: status === "ACTIVE", note: status === "VERIFIED" ? "At least two Safe owners and threshold 2 are required for token operations." : null });
    return true;
  }

  if (input.url.pathname === "/api/v1/platform/property-identity/web3/token-operations" && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const idempotencyKey = input.request.headers["idempotency-key"];
    if (!validateIdempotencyKey(idempotencyKey)) throw new ActorAuthError("IDEMPOTENCY_KEY_INVALID", 400, "A valid Idempotency-Key is required.");
    const identityProfileId = requiredString(body, "identityProfileId");
    const operationType = requiredString(body, "operationType").toUpperCase();
    if (!["MINT", "UPDATE_HASHES", "SUSPEND", "UNSUSPEND", "REVOKE", "REASSIGN"].includes(operationType)) throw new ActorAuthError("FORBIDDEN", 400, "Unsupported token operation.");
    const profile = await input.prisma.propertyIdentityProfile.findUnique({
      where: { id: identityProfileId },
      include: { canonicalVersions: { where: { isCurrent: true }, orderBy: { versionNumber: "desc" }, take: 1 }, claims: { where: { status: "ACTIVE" } }, originatorRecords: { where: { status: "RECORDED" }, orderBy: { createdAt: "asc" }, take: 1 }, token: true },
    });
    if (!profile || profile.status !== "VERIFIED_INTERNAL") throw new ActorAuthError("FORBIDDEN", 409, "A verified identity profile is required.");
    const canonical = profile.canonicalVersions[0];
    const originator = profile.originatorRecords[0];
    if (!canonical || !originator) throw new ActorAuthError("FORBIDDEN", 409, "Canonical version and originator are required.");
    const config = readChainConfig(env);
    const contract = await input.prisma.blockchainContractRegistry.findFirst({ where: { chainId: config.chainId, contractType: "BEP721_PROPERTY_IDENTITY", active: true, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
    if (!contract) throw new ActorAuthError("FORBIDDEN", 409, "An active registry contract is not configured.");
    if (!contract.registryAdminSafeAddress) throw new ActorAuthError("FORBIDDEN", 409, "The active registry contract has no verified Registry/Admin Safe.");
    const wallet = await input.prisma.organizationCorporateWallet.findFirst({ where: { organizationId: originator.organizationId, chainId: config.chainId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } });
    if (!wallet) throw new ActorAuthError("FORBIDDEN", 409, "The originator has no active Corporate Safe.");
    const tokenId = profile.token?.tokenId.toFixed(0) ?? deterministicTokenId(profile.stableId).toString();
    const publicPayload = buildPublicTokenPayload({ stablePropertyIdentityId: profile.stableId, canonicalVersionHash: bytes32(canonical.snapshotHash), evidencePackageHash: bytes32(JSON.stringify(profile.claims.map((claim) => ({ id: claim.id, scheme: claim.scheme, status: claim.status })))) });
    const targetAddress = operationType === "REASSIGN" ? requiredString(body, "targetAddress") : wallet.walletAddress;
    const operationPayload: Record<string, unknown> = { tokenId, to: targetAddress, ...publicPayload, uri: typeof body.tokenUri === "string" ? body.tokenUri : "" };
    const encodedCall = encodeRegistryOperation(operationType as "MINT" | "UPDATE_HASHES" | "SUSPEND" | "UNSUSPEND" | "REVOKE" | "REASSIGN", operationPayload);
    const created = await input.prisma.$transaction(async (tx) => {
      let tokenRecordId = profile.token?.id;
      if (operationType === "MINT") {
        if (profile.token && profile.token.status !== "PENDING") throw new ActorAuthError("FORBIDDEN", 409, "The identity already has a token.");
        const token = profile.token ?? await tx.propertyIdentityToken.create({ data: { identityProfileId: profile.id, tokenId: new Prisma.Decimal(tokenId), chainId: config.chainId, contractAddress: contract.contractAddress, ownerWalletId: wallet.id, ownerAddress: wallet.walletAddress, status: "PENDING", reconciliationStatus: "PENDING", tokenUri: String(operationPayload.uri) || null } });
        tokenRecordId = token.id;
      } else if (!profile.token) throw new ActorAuthError("FORBIDDEN", 409, "The identity token does not exist.");
      return tx.propertyTokenOperation.create({ data: { tokenRecordId, identityProfileId: profile.id, operationType, status: "PENDING_REGISTRY_SAFE", payloadJson: { chainId: config.chainId, contractAddress: contract.contractAddress, registryAdminSafeAddress: contract.registryAdminSafeAddress, corporateSafe: wallet.walletAddress, targetAddress, encodedCall, safeTransaction: { safe: contract.registryAdminSafeAddress, to: contract.contractAddress, value: "0", data: encodedCall, operation: 0 }, reason: typeof body.reason === "string" ? body.reason : null }, idempotencyKey, requestedByUserId: input.actor.appUserId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    });
    sendJson(input.response, 202, { ok: true, operation: created, execution: "IREPN_REGISTRY_ADMIN_SAFE_REQUIRED", chainWritePerformed: false });
    return true;
  }

  const proposeMatch = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/web3\/token-operations\/([^/]+)\/propose-safe-transaction$/);
  if (proposeMatch && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const operationId = decodeURIComponent(proposeMatch[1]);
    const operation = await input.prisma.propertyTokenOperation.findUnique({ where: { id: operationId }, include: { tokenRecord: true } });
    if (!operation || !operation.tokenRecord) throw new ActorAuthError("FORBIDDEN", 404, "Token operation was not found.");
    if (operation.status !== "PENDING_REGISTRY_SAFE") throw new ActorAuthError("FORBIDDEN", 409, "Only a pending Safe operation can be proposed.");
    const payload = operation.payloadJson && typeof operation.payloadJson === "object" && !Array.isArray(operation.payloadJson) ? operation.payloadJson as Record<string, unknown> : {};
    const expectedSafe = normalizeAddress(String(payload.registryAdminSafeAddress ?? ""));
    const expectedTo = normalizeAddress(String(payload.contractAddress ?? ""));
    const expectedData = String(payload.encodedCall ?? "").toLowerCase();
    const senderAddress = normalizeAddress(requiredString(body, "senderAddress"));
    const safeTxHash = requiredString(body, "safeTxHash").toLowerCase();
    const senderSignature = requiredString(body, "senderSignature").toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(safeTxHash) || !/^0x[0-9a-f]+$/.test(senderSignature)) throw new ActorAuthError("FORBIDDEN", 400, "Safe transaction hash or signature is invalid.");
    const raw = body.safeTransactionData;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ActorAuthError("FORBIDDEN", 400, "safeTransactionData is required.");
    const tx = raw as Record<string, unknown>;
    const safeTransactionData = {
      to: normalizeAddress(String(tx.to ?? "")), value: String(tx.value ?? ""), data: String(tx.data ?? "").toLowerCase(), operation: Number(tx.operation),
      safeTxGas: String(tx.safeTxGas ?? ""), baseGas: String(tx.baseGas ?? ""), gasPrice: String(tx.gasPrice ?? ""), gasToken: normalizeAddress(String(tx.gasToken ?? "")), refundReceiver: normalizeAddress(String(tx.refundReceiver ?? "")), nonce: Number(tx.nonce),
    };
    if (safeTransactionData.to !== expectedTo || safeTransactionData.value !== "0" || safeTransactionData.data !== expectedData || safeTransactionData.operation !== 0) throw new ActorAuthError("FORBIDDEN", 409, "The signed Safe transaction does not match the queued registry operation.");
    if (![safeTransactionData.safeTxGas, safeTransactionData.baseGas, safeTransactionData.gasPrice].every((item) => /^\d+$/.test(item)) || !Number.isSafeInteger(safeTransactionData.nonce) || safeTransactionData.nonce < 0) throw new ActorAuthError("FORBIDDEN", 400, "Safe gas fields or nonce are invalid.");
    const config = readChainConfig({ ...env, PROPERTY_IDENTITY_CHAIN_ID: String(operation.tokenRecord.chainId) });
    const safe = await new SafeRpcAdapter(config.rpcUrl).readSafe(expectedSafe);
    if (!safe.owners.some((owner) => owner === senderAddress)) throw new ActorAuthError("FORBIDDEN", 403, "The connected signer is not an owner of Registry/Admin Safe.");
    try {
      await safeApiKit(env, config.chainId).proposeTransaction({ safeAddress: expectedSafe, safeTransactionData, safeTxHash, senderAddress, senderSignature, origin: `KVARTAL Property Identity ${operation.id}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SAFE_TRANSACTION_PROPOSAL_FAILED";
      throw new ActorAuthError("FORBIDDEN", 502, `Safe Transaction Service rejected the proposal: ${message}`);
    }
    await input.prisma.propertyTokenOperation.update({ where: { id: operation.id }, data: { registrySafeTxHash: safeTxHash } });
    sendJson(input.response, 202, { ok: true, safeTxHash, status: "PENDING_REGISTRY_SAFE", requiredConfirmations: safe.threshold });
    return true;
  }

  const syncSafeMatch = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/web3\/token-operations\/([^/]+)\/sync-safe-transaction$/);
  if (syncSafeMatch && input.request.method === "POST") {
    const operationId = decodeURIComponent(syncSafeMatch[1]);
    const operation = await input.prisma.propertyTokenOperation.findUnique({ where: { id: operationId }, include: { tokenRecord: true } });
    if (!operation || !operation.tokenRecord || !operation.registrySafeTxHash) throw new ActorAuthError("FORBIDDEN", 404, "A proposed Safe transaction was not found.");
    const config = readChainConfig({ ...env, PROPERTY_IDENTITY_CHAIN_ID: String(operation.tokenRecord.chainId) });
    let serviceTransaction;
    try { serviceTransaction = await safeApiKit(env, config.chainId).getTransaction(operation.registrySafeTxHash); }
    catch (error) { throw new ActorAuthError("FORBIDDEN", 502, `Safe Transaction Service status is unavailable: ${error instanceof Error ? error.message : "SAFE_STATUS_FAILED"}`); }
    const confirmations = serviceTransaction.confirmations?.length ?? 0;
    const status = serviceTransaction.isExecuted ? "SUBMITTED" : confirmations >= serviceTransaction.confirmationsRequired ? "READY_TO_EXECUTE" : "PENDING_REGISTRY_SAFE";
    await input.prisma.$transaction([
      input.prisma.propertyTokenOperation.update({ where: { id: operation.id }, data: { status, ...(serviceTransaction.transactionHash ? { chainTxHash: serviceTransaction.transactionHash } : {}) } }),
      ...(serviceTransaction.transactionHash ? [input.prisma.propertyIdentityToken.update({ where: { id: operation.tokenRecord.id }, data: { lastTxHash: serviceTransaction.transactionHash, reconciliationStatus: "PENDING" } })] : []),
    ]);
    sendJson(input.response, 200, { ok: true, safeTxHash: serviceTransaction.safeTxHash, status, confirmations, confirmationsRequired: serviceTransaction.confirmationsRequired, isExecuted: serviceTransaction.isExecuted, isSuccessful: serviceTransaction.isSuccessful, chainTxHash: serviceTransaction.transactionHash, serviceTransaction });
    return true;
  }

  const submittedMatch = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/web3\/token-operations\/([^/]+)\/record-chain-tx$/);
  if (submittedMatch && input.request.method === "POST") {
    const body = await readJsonBody(input.request);
    const chainTxHash = requiredString(body, "chainTxHash");
    if (!/^0x[0-9a-fA-F]{64}$/.test(chainTxHash)) throw new ActorAuthError("FORBIDDEN", 400, "A valid chain transaction hash is required.");
    const operationId = decodeURIComponent(submittedMatch[1]);
    const operation = await input.prisma.propertyTokenOperation.findUnique({ where: { id: operationId } });
    if (!operation || !operation.tokenRecordId) throw new ActorAuthError("FORBIDDEN", 404, "Token operation was not found.");
    if (!["PENDING_REGISTRY_SAFE", "READY_TO_EXECUTE", "SUBMITTED"].includes(operation.status)) throw new ActorAuthError("FORBIDDEN", 409, "The operation cannot accept a chain transaction in its current state.");
    await input.prisma.$transaction([
      input.prisma.propertyTokenOperation.update({ where: { id: operation.id }, data: { status: "SUBMITTED", chainTxHash, registrySafeTxHash: typeof body.registrySafeTxHash === "string" ? body.registrySafeTxHash : operation.registrySafeTxHash } }),
      input.prisma.propertyIdentityToken.update({ where: { id: operation.tokenRecordId }, data: { lastTxHash: chainTxHash, reconciliationStatus: "PENDING" } }),
    ]);
    sendJson(input.response, 202, { ok: true, reconciliationRequired: true, chainWritePerformedByApi: false });
    return true;
  }

  const reconcileMatch = input.url.pathname.match(/^\/api\/v1\/platform\/property-identity\/web3\/tokens\/([^/]+)\/reconcile$/);
  if (reconcileMatch && input.request.method === "POST") {
    const tokenId = decodeURIComponent(reconcileMatch[1]);
    const token = await input.prisma.propertyIdentityToken.findUnique({ where: { id: tokenId }, include: { operations: { where: { status: "SUBMITTED" }, orderBy: { updatedAt: "desc" }, take: 1 } } });
    if (!token) throw new ActorAuthError("FORBIDDEN", 404, "Identity token was not found.");
    const config = readChainConfig({ ...env, PROPERTY_IDENTITY_CHAIN_ID: String(token.chainId) });
    let chain;
    try { chain = await new RegistryRpcAdapter(config.rpcUrl).readToken(token.contractAddress, BigInt(token.tokenId.toFixed(0))); }
    catch { await input.prisma.propertyIdentityToken.update({ where: { id: token.id }, data: { reconciliationStatus: "RPC_UNAVAILABLE", lastReconciledAt: new Date() } }); throw new ActorAuthError("FORBIDDEN", 503, "Blockchain RPC is unavailable; no database state was promoted."); }
    const operation = token.operations[0];
    const payload = operation?.payloadJson && typeof operation.payloadJson === "object" && !Array.isArray(operation.payloadJson) ? operation.payloadJson as Record<string, unknown> : {};
    const expectedOwner = operation?.operationType === "REASSIGN" && typeof payload.targetAddress === "string" ? payload.targetAddress.toLowerCase() : token.ownerAddress.toLowerCase();
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
    await input.prisma.$transaction(async (tx) => {
      await tx.propertyIdentityToken.update({ where: { id: token.id }, data: { ownerAddress: chain.owner, status: chainStatus === "ACTIVE" && operation?.operationType === "REASSIGN" ? "REASSIGNED" : chainStatus, reconciliationStatus: "IN_SYNC", lastReconciledAt: new Date(), ...(operation?.operationType === "MINT" ? { issuedAt: new Date() } : {}), ...(chainStatus === "SUSPENDED" ? { suspendedAt: new Date() } : {}), ...(chainStatus === "REVOKED" ? { revokedAt: new Date() } : {}) } });
      if (operation) {
        await tx.propertyTokenOperation.update({ where: { id: operation.id }, data: { status: "CONFIRMED" } });
        if (operation.chainTxHash) await tx.propertyTokenEvent.upsert({ where: { chainId_txHash_logIndex: { chainId: token.chainId, txHash: operation.chainTxHash, logIndex: 0 } }, update: { blockNumber: chain.blockNumber, payloadJson: { operationType: operation.operationType, reconciled: true } }, create: { tokenRecordId: token.id, eventName: operation.operationType, chainId: token.chainId, txHash: operation.chainTxHash, logIndex: 0, blockNumber: chain.blockNumber, payloadJson: { reconciled: true } } });
      }
      await tx.blockchainReconciliationIssue.updateMany({ where: { tokenRecordId: token.id, resolvedAt: null }, data: { status: "RESOLVED", resolvedAt: new Date(), publicStatus: "VERIFIED" } });
      await tx.blockchainReconciliationCheckpoint.upsert({ where: { chainId_contractAddress: { chainId: token.chainId, contractAddress: token.contractAddress } }, update: { lastBlockNumber: chain.blockNumber, status: "IN_SYNC", lastRunAt: new Date(), errorCode: null }, create: { chainId: token.chainId, contractAddress: token.contractAddress, lastBlockNumber: chain.blockNumber, status: "IN_SYNC", lastRunAt: new Date() } });
    });
    sendJson(input.response, 200, { ok: true, reconciliationStatus: "IN_SYNC", ownerAddress: chain.owner, status: chainStatus, blockNumber: chain.blockNumber.toString() });
    return true;
  }

  return false;
}
