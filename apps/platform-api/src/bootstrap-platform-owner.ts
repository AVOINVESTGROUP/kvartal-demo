import { createHash, timingSafeEqual } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Prisma, PrismaClient } from "@prisma/client";
import { ActorAuthError, digestSubject, firebaseAdminAuth } from "@kvartal/auth";

type Args = { appUserId: string; firebaseUid: string; reason: string; dryRun: boolean };

function parseArgs(values: string[]): Args {
  const get = (name: string) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : undefined; };
  const appUserId = get("--app-user-id"); const firebaseUid = get("--firebase-uid"); const reason = get("--reason")?.trim();
  if (!appUserId || !firebaseUid || !reason || reason.length < 10 || reason.length > 1000) throw new Error("Required: --app-user-id, --firebase-uid, --reason (10–1000 chars).");
  return { appUserId, firebaseUid, reason, dryRun: values.includes("--dry-run") };
}

function safeSecretEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest(); const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function bootstrapPlatformOwner(input: {
  args: Args; confirmation: string; suppliedSecret: string; expectedSecret: string; enabled: boolean; environment: string;
  prisma: PrismaClient; getFirebaseUser: (uid: string) => Promise<{ uid: string; emailVerified: boolean }>;
}) {
  if (!input.enabled) throw new ActorAuthError("BOOTSTRAP_DISABLED", 403, "Bootstrap is disabled.");
  if (!input.environment || input.confirmation !== input.environment) throw new Error("Environment confirmation did not match.");
  if (!safeSecretEqual(input.suppliedSecret, input.expectedSecret)) throw new Error("Bootstrap secret is invalid.");
  const user = await input.prisma.appUser.findUnique({ where: { id: input.args.appUserId }, include: { platformRoleAssignments: true } });
  if (!user?.active || !user.platformRoleAssignments.some((role) => role.active && role.role === "platform_owner")) throw new Error("Target user is not an active platform_owner.");
  const firebaseUser = await input.getFirebaseUser(input.args.firebaseUid);
  if (firebaseUser.uid !== input.args.firebaseUid || !firebaseUser.emailVerified) throw new Error("Firebase user is absent or email is not verified.");
  const state = await input.prisma.externalIdentityBootstrapState.findUnique({ where: { key: "FIREBASE_PLATFORM_OWNER_BOOTSTRAP" } });
  if (state?.status === "COMPLETED") throw new ActorAuthError("BOOTSTRAP_ALREADY_COMPLETED", 409, "Bootstrap was already completed.");
  if (state?.status === "DISABLED") throw new ActorAuthError("BOOTSTRAP_DISABLED", 403, "Bootstrap is disabled.");
  const existingOwnerIdentity = await input.prisma.appUserExternalIdentity.findFirst({ where: { provider: "FIREBASE", status: "ACTIVE", appUser: { active: true, platformRoleAssignments: { some: { active: true, role: "platform_owner" } } } } });
  if (existingOwnerIdentity) throw new ActorAuthError("BOOTSTRAP_ALREADY_COMPLETED", 409, "An active platform owner identity already exists.");
  if (input.args.dryRun) return { dryRun: true, appUserId: user.id, firebaseUidDigest: digestSubject(input.args.firebaseUid, process.env.EXTERNAL_IDENTITY_SUBJECT_DIGEST_PEPPER ?? "local-test-only-subject-pepper") };
  return input.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('FIREBASE_PLATFORM_OWNER_BOOTSTRAP'))`;
    const lockedState = await tx.externalIdentityBootstrapState.findUnique({ where: { key: "FIREBASE_PLATFORM_OWNER_BOOTSTRAP" } });
    if (lockedState?.status === "COMPLETED") throw new ActorAuthError("BOOTSTRAP_ALREADY_COMPLETED", 409, "Bootstrap was already completed.");
    if (lockedState?.status === "DISABLED") throw new ActorAuthError("BOOTSTRAP_DISABLED", 403, "Bootstrap is disabled.");
    const lockedOwnerIdentity = await tx.appUserExternalIdentity.findFirst({ where: { provider: "FIREBASE", status: "ACTIVE", appUser: { active: true, platformRoleAssignments: { some: { active: true, role: "platform_owner" } } } } });
    if (lockedOwnerIdentity) throw new ActorAuthError("BOOTSTRAP_ALREADY_COMPLETED", 409, "An active platform owner identity already exists.");
    const identity = await tx.appUserExternalIdentity.create({ data: { appUserId: user.id, provider: "FIREBASE", subject: input.args.firebaseUid, boundByUserId: null } });
    const event = await tx.externalIdentityBindingEvent.create({ data: { externalIdentityId: identity.id, eventType: "BOOTSTRAP_COMPLETED", actorType: "BOOTSTRAP_SYSTEM", actorProvider: "FIREBASE", actorSubjectDigest: digestSubject(input.args.firebaseUid, process.env.EXTERNAL_IDENTITY_SUBJECT_DIGEST_PEPPER ?? "local-test-only-subject-pepper"), nextStatus: "ACTIVE", reasonCode: "BOOTSTRAP_COMPLETED", metadata: { reason: input.args.reason } } });
    await tx.externalIdentityBootstrapState.upsert({ where: { key: "FIREBASE_PLATFORM_OWNER_BOOTSTRAP" }, create: { key: "FIREBASE_PLATFORM_OWNER_BOOTSTRAP", status: "COMPLETED", targetAppUserId: user.id, externalIdentityId: identity.id, completedAt: new Date(), auditEventId: event.id }, update: { status: "COMPLETED", targetAppUserId: user.id, externalIdentityId: identity.id, completedAt: new Date(), auditEventId: event.id, rowVersion: { increment: 1 } } });
    return { dryRun: false, appUserId: user.id, externalIdentityId: identity.id, auditEventId: event.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must explicitly identify the target database.");
  const environment = process.env.PLATFORM_OWNER_BOOTSTRAP_ENVIRONMENT ?? "";
  const expectedSecret = process.env.PLATFORM_OWNER_BOOTSTRAP_SECRET ?? "";
  if (!environment || !expectedSecret) throw new Error("Bootstrap environment and protected secret are required.");
  const prompt = createInterface({ input: stdin, output: stdout });
  const confirmation = await prompt.question(`Type environment name '${environment}' to continue: `);
  const suppliedSecret = await prompt.question("Bootstrap secret: ");
  prompt.close();
  const prisma = new PrismaClient();
  try {
    const result = await bootstrapPlatformOwner({ args: parseArgs(process.argv.slice(2)), confirmation, suppliedSecret, expectedSecret, enabled: process.env.PLATFORM_OWNER_BOOTSTRAP_ENABLED === "true", environment, prisma, getFirebaseUser: (uid) => firebaseAdminAuth().getUser(uid) });
    console.log(JSON.stringify(result));
  } finally { await prisma.$disconnect(); }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) void main().catch((error) => { console.error(error instanceof Error ? error.message : "Bootstrap failed."); process.exitCode = 1; });
