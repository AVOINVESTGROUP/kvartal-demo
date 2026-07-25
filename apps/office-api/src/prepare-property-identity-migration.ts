import { PrismaClient, type AssetClass } from "@prisma/client";

type Arguments = {
  authorUserId: string;
  jurisdiction: string;
  organizationId?: string;
  limit: number;
  apply: boolean;
  confirmEnvironment?: string;
};

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseArguments(): Arguments {
  const authorUserId = readArgument("--author-user-id")?.trim() ?? "";
  const jurisdiction = readArgument("--jurisdiction")?.trim().toLocaleUpperCase("und") ?? "";
  const limit = Number(readArgument("--limit") ?? 100);
  if (!authorUserId) throw new Error("--author-user-id is required.");
  if (!/^[A-Z0-9_-]{2,16}$/.test(jurisdiction)) throw new Error("--jurisdiction must be a 2-16 character jurisdiction code.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error("--limit must be an integer from 1 to 1000.");
  return {
    authorUserId,
    jurisdiction,
    organizationId: readArgument("--organization-id")?.trim() || undefined,
    limit,
    apply: process.argv.includes("--apply"),
    confirmEnvironment: readArgument("--confirm-environment")?.trim(),
  };
}

function subjectScope(assetClass: AssetClass) {
  if (assetClass === "land") return "LAND_PARCEL" as const;
  if (assetClass === "development_project" || assetClass === "investment_project") return "PROJECT" as const;
  if (["house", "warehouse", "industrial_site", "factory", "hotel", "mixed_use"].includes(assetClass)) return "BUILDING" as const;
  return "UNIT" as const;
}

async function main() {
  const args = parseArguments();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be explicitly configured.");
  const environment = process.env.PROPERTY_IDENTITY_MIGRATION_ENVIRONMENT?.trim();
  if (args.apply) {
    if (process.env.PROPERTY_IDENTITY_MIGRATION_ENABLED !== "true") throw new Error("PROPERTY_IDENTITY_MIGRATION_ENABLED=true is required for --apply.");
    if (!environment || args.confirmEnvironment !== environment) throw new Error("--confirm-environment must exactly match PROPERTY_IDENTITY_MIGRATION_ENVIRONMENT.");
  }
  const prisma = new PrismaClient();
  try {
    const author = await prisma.appUser.findFirst({
      where: { id: args.authorUserId, active: true },
      include: { organizationMemberships: { where: { active: true } }, officeMemberships: { where: { active: true } } },
    });
    if (!author) throw new Error("The assigned author must be an active AppUser.");
    const objects = await prisma.propertyObject.findMany({
      where: {
        ...(args.organizationId ? { ownerOrganizationId: args.organizationId } : {}),
        identityProfile: null,
        migrationRegistrationSubmission: null,
      },
      include: { localizations: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: args.limit,
    });
    const organisationAdminIds = new Set(author.organizationMemberships
      .filter((membership) => membership.roles.some((role) => role === "organization_owner" || role === "organization_admin"))
      .map((membership) => membership.organizationId));
    const eligible = objects.filter((object) => organisationAdminIds.has(object.ownerOrganizationId) || author.officeMemberships.some((membership) =>
      membership.organizationId === object.ownerOrganizationId && membership.officeId === object.ownerOfficeId && membership.roles.some((role) => role === "office_owner" || role === "office_admin" || role === "broker")));
    const skippedForScope = objects.length - eligible.length;
    if (!args.apply) {
      process.stdout.write(`${JSON.stringify({ mode: "dry-run", environment: environment ?? null, candidates: objects.length, eligible: eligible.length, skippedForScope })}\n`);
      return;
    }
    const createdIds: string[] = [];
    for (const object of eligible) {
      const ru = object.localizations.find((item) => item.language === "ru") ?? object.localizations[0];
      const en = object.localizations.find((item) => item.language === "en");
      const identityInput = {
        title: ru?.title ?? undefined,
        titleEn: en?.title ?? undefined,
        description: ru?.description ?? undefined,
        descriptionEn: en?.description ?? undefined,
        addressDisplay: ru?.addressDisplay ?? undefined,
        addressDisplayEn: en?.addressDisplay ?? undefined,
        addressPrivate: object.addressPrivate ?? ru?.addressDisplay ?? undefined,
        assetSubtype: object.assetSubtype ?? undefined,
        areaSqm: object.areaSqm?.toString(),
        landAreaSqm: object.landAreaSqm?.toString(),
        buildingAreaSqm: object.buildingAreaSqm?.toString(),
        rentableAreaSqm: object.rentableAreaSqm?.toString(),
        floorNumber: object.floorNumber ?? undefined,
        floorsTotal: object.floorsTotal ?? undefined,
        roomsCount: object.roomsCount ?? undefined,
        bedroomsCount: object.bedroomsCount ?? undefined,
        bathroomsCount: object.bathroomsCount ?? undefined,
      };
      const submission = await prisma.$transaction(async (tx) => {
        const created = await tx.propertyRegistrationSubmission.create({
          data: {
            organizationId: object.ownerOrganizationId,
            officeId: object.ownerOfficeId,
            marketId: object.marketId,
            createdByUserId: author.id,
            migrationSourcePropertyObjectId: object.id,
            subjectScope: subjectScope(object.assetClass),
            jurisdiction: args.jurisdiction,
            assetClass: object.assetClass,
            status: "DRAFT",
            identityInput,
          },
        });
        await tx.propertyIdentityEvent.create({
          data: {
            submissionId: created.id,
            actorOrganizationId: object.ownerOrganizationId,
            actorOfficeId: object.ownerOfficeId,
            eventType: "MIGRATION_SUBMISSION_PREPARED",
            previousStatus: null,
            nextStatus: "DRAFT",
            payload: { migrationSourcePropertyObjectId: object.id, assignedAuthorUserId: author.id, environment },
          },
        });
        return created;
      });
      createdIds.push(submission.id);
    }
    process.stdout.write(`${JSON.stringify({ mode: "apply", environment, created: createdIds.length, skippedForScope, submissionIds: createdIds })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((caught) => {
  process.stderr.write(`${caught instanceof Error ? caught.message : "Migration preparation failed."}\n`);
  process.exitCode = 1;
});
