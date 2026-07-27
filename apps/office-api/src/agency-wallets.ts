import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PrismaClient } from "@prisma/client";
import { ActorAuthError, structuredAuthError, type ActorContext } from "@kvartal/auth";
import { agencyWalletChallenge, normalizeAddress, readChainConfig, verifyAgencyWalletSignature } from "@kvartal/web3";

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new ActorAuthError("FORBIDDEN", 400, `${field} is required.`);
  return value.trim();
}

function assertAgencyWalletAdmin(actor: ActorContext, organizationId: string) {
  const membership = actor.organizationMemberships.find((item) => item.organizationId === organizationId);
  if (!membership?.roles.some((role) => role === "organization_owner" || role === "organization_admin")) {
    throw new ActorAuthError("FORBIDDEN", 403, "Only an owner or administrator of this organization can connect its corporate wallet.");
  }
}

export async function handleAgencyWalletRequest(input: {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  prisma: PrismaClient;
  actor: ActorContext;
  env?: NodeJS.ProcessEnv;
}) {
  if (!input.url.pathname.startsWith("/api/v1/admin/corporate-wallets")) return false;

  try {
    const config = readChainConfig(input.env ?? process.env);

    if (input.url.pathname === "/api/v1/admin/corporate-wallets" && input.request.method === "GET") {
      const organizationId = requiredString(input.url.searchParams.get("organizationId"), "organizationId");
      assertAgencyWalletAdmin(input.actor, organizationId);
      const wallets = await input.prisma.organizationCorporateWallet.findMany({
        where: { organizationId, chainId: config.chainId, status: { notIn: ["REPLACED"] } },
        select: { id: true, walletAddress: true, walletType: true, chainId: true, status: true, verifiedAt: true, revokedAt: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });
      sendJson(input.response, 200, { ok: true, chain: { chainId: config.chainId, name: config.name }, wallets });
      return true;
    }

    if (input.url.pathname === "/api/v1/admin/corporate-wallets/challenge" && input.request.method === "POST") {
      const body = await readJsonBody(input.request);
      const organizationId = requiredString(body.organizationId, "organizationId");
      assertAgencyWalletAdmin(input.actor, organizationId);
      const walletAddress = normalizeAddress(requiredString(body.walletAddress, "walletAddress"));
      const nonce = randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const challenge = agencyWalletChallenge({ chainId: config.chainId, walletAddress, organizationId, actorUserId: input.actor.appUserId, nonce, expiresAt });
      const wallet = await input.prisma.organizationCorporateWallet.upsert({
        where: { organizationId_chainId_walletAddress: { organizationId, chainId: config.chainId, walletAddress } },
        update: { status: "CHALLENGE_ISSUED", walletType: "EOA", challengeUserId: input.actor.appUserId, lastChallengeNonce: nonce, lastChallengeExpiresAt: expiresAt },
        create: { organizationId, chainId: config.chainId, walletAddress, walletType: "EOA", status: "CHALLENGE_ISSUED", challengeUserId: input.actor.appUserId, lastChallengeNonce: nonce, lastChallengeExpiresAt: expiresAt },
      });
      sendJson(input.response, 201, { ok: true, walletId: wallet.id, expiresAt, typedData: challenge.typedData });
      return true;
    }

    if (input.url.pathname === "/api/v1/admin/corporate-wallets/verify" && input.request.method === "POST") {
      const body = await readJsonBody(input.request);
      const walletId = requiredString(body.walletId, "walletId");
      const signature = requiredString(body.signature, "signature");
      if (!/^0x[0-9a-fA-F]+$/.test(signature)) throw new ActorAuthError("FORBIDDEN", 400, "signature is invalid.");
      const wallet = await input.prisma.organizationCorporateWallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new ActorAuthError("FORBIDDEN", 404, "Corporate wallet challenge was not found.");
      assertAgencyWalletAdmin(input.actor, wallet.organizationId);
      if (wallet.status !== "CHALLENGE_ISSUED" || !wallet.lastChallengeNonce || !wallet.lastChallengeExpiresAt || wallet.challengeUserId !== input.actor.appUserId) {
        throw new ActorAuthError("FORBIDDEN", 409, "This wallet challenge is not active for the current user.");
      }
      if (wallet.lastChallengeExpiresAt.getTime() <= Date.now()) throw new ActorAuthError("FORBIDDEN", 409, "The wallet challenge has expired.");
      const challenge = agencyWalletChallenge({ chainId: wallet.chainId as 56 | 97, walletAddress: wallet.walletAddress, organizationId: wallet.organizationId, actorUserId: input.actor.appUserId, nonce: wallet.lastChallengeNonce, expiresAt: wallet.lastChallengeExpiresAt });
      const valid = await verifyAgencyWalletSignature({ ...challenge, signature: signature as `0x${string}` });
      if (!valid) throw new ActorAuthError("FORBIDDEN", 403, "The signature was not produced by the selected corporate wallet.");
      const verified = await input.prisma.organizationCorporateWallet.update({
        where: { id: wallet.id },
        data: { status: "ACTIVE", verifiedByUserId: input.actor.appUserId, verifiedAt: new Date(), challengeUserId: null, lastChallengeNonce: null, lastChallengeExpiresAt: null },
        select: { id: true, organizationId: true, walletAddress: true, chainId: true, status: true, verifiedAt: true },
      });
      sendJson(input.response, 200, { ok: true, wallet: verified });
      return true;
    }

    sendJson(input.response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Unsupported corporate-wallet operation.", correlationId: input.actor.correlationId } });
    return true;
  } catch (caught) {
    const error = caught instanceof ActorAuthError ? caught : new ActorAuthError("FORBIDDEN", 400, caught instanceof Error ? caught.message : "Corporate wallet operation failed.");
    sendJson(input.response, error.status, structuredAuthError(error.code, error.message, input.actor.correlationId));
    return true;
  }
}
