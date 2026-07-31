import type { Prisma, PrismaClient } from "@prisma/client";
import { readRetentionConfig } from "@kvartal/auth";

export async function redactEligibleBindingRequestPii(prisma: PrismaClient, now = new Date(), dryRun = true) {
  const { requestDays } = readRetentionConfig(process.env);
  const cutoff = new Date(now.getTime() - requestDays * 86_400_000);
  const where: Prisma.ExternalIdentityBindingRequestWhereInput = { status: { in: ["REJECTED", "EXPIRED", "CANCELLED"] }, updatedAt: { lt: cutoff }, verifiedEmail: { not: null } };
  const eligible = await prisma.externalIdentityBindingRequest.count({ where });
  if (!dryRun && eligible > 0) await prisma.externalIdentityBindingRequest.updateMany({ where, data: { verifiedEmail: null } });
  return { eligible, redacted: dryRun ? 0 : eligible, cutoff };
}

export async function countExpiredExternalIdentityAudit(prisma: PrismaClient, now = new Date()) {
  const { auditDays } = readRetentionConfig(process.env);
  const cutoff = new Date(now.getTime() - auditDays * 86_400_000);
  return { eligible: await prisma.externalIdentityBindingEvent.count({ where: { createdAt: { lt: cutoff } } }), cutoff };
}
