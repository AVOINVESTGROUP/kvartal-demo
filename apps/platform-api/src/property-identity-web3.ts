import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ActorAuthError, validateIdempotencyKey, type ActorContext } from "@kvartal/auth";
import { buildPublicTokenPayload, corporateWalletChallenge, deterministicTokenId, encodeRegistryOperation, readChainConfig, RegistryRpcAdapter, SafeRpcAdapter, type SupportedChainId } from "@kvartal/web3";

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
      contracts, tokenGroups, operationGroups, tokens, operations, issues, organizations,
      eligibleProfiles: eligibleProfiles.map((profile) => ({ id: profile.id, stableId: profile.stableId, title: profile.propertyObject.localizations[0]?.title ?? profile.stableId, token: profile.token })),
    });
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
      return tx.propertyTokenOperation.create({ data: { tokenRecordId, identityProfileId: profile.id, operationType, status: "PENDING_REGISTRY_SAFE", payloadJson: { chainId: config.chainId, contractAddress: contract.contractAddress, corporateSafe: wallet.walletAddress, targetAddress, encodedCall, reason: typeof body.reason === "string" ? body.reason : null }, idempotencyKey, requestedByUserId: input.actor.appUserId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    });
    sendJson(input.response, 202, { ok: true, operation: created, execution: "IREPN_REGISTRY_ADMIN_SAFE_REQUIRED", chainWritePerformed: false });
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
