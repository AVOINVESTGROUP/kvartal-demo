import { exec } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { PrismaClient } from "@prisma/client";

const run = promisify(exec);
let container: StartedTestContainer;
let prisma: PrismaClient;
let fixtureSequence = 0;

async function createFoundationFixture() {
  fixtureSequence += 1;
  const suffix = String(fixtureSequence);
  const organization = await prisma.organization.create({
    data: {
      slug: `identity-test-org-${suffix}`,
      legalName: "Identity Test Organisation",
      countryOfRegistration: "ZZ",
      operatingCountryCodes: ["ZZ"],
      status: "active",
    },
  });
  const market = await prisma.market.create({
    data: {
      slug: `identity-test-market-${suffix}`,
      city: "Test City",
      country: "ZZ",
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      supportedLanguages: ["en"],
      assetClasses: ["apartment"],
      complianceRegion: "synthetic-test-only",
    },
  });
  const office = await prisma.office.create({
    data: {
      organizationId: organization.id,
      slug: `identity-test-office-${suffix}`,
      legalName: "Identity Test Office",
      city: "Test City",
      country: "ZZ",
      defaultMarketId: market.id,
      status: "active",
    },
  });
  const user = await prisma.appUser.create({
    data: {
      firebaseUid: `legacy:identity-test-user:${suffix}`,
      email: `identity-test-${suffix}@example.invalid`,
      active: true,
      organizationMemberships: {
        create: { organizationId: organization.id, roles: ["organization_admin"], active: true },
      },
      officeMemberships: {
        create: {
          organizationId: organization.id,
          officeId: office.id,
          roles: ["office_admin"],
          active: true,
        },
      },
    },
  });
  const propertyObject = await prisma.propertyObject.create({
    data: {
      ownerOrganizationId: organization.id,
      ownerOfficeId: office.id,
      informationOwnerOrganizationId: organization.id,
      informationOwnerOfficeId: office.id,
      createdByUserId: user.id,
      marketId: market.id,
      assetClass: "apartment",
    },
  });
  const submission = await prisma.propertyRegistrationSubmission.create({
    data: {
      organizationId: organization.id,
      officeId: office.id,
      marketId: market.id,
      createdByUserId: user.id,
      subjectScope: "UNIT",
      jurisdiction: "ZZ",
      assetClass: "apartment",
      status: "UNIQUE_CANDIDATE",
      identityInput: { unit: "42" },
      lastIdentityInputHash: "fixture-input-hash",
    },
  });
  const checkRun = await prisma.propertyIdentityCheckRun.create({
    data: {
      submissionId: submission.id,
      status: "RESOLVED",
      outcome: "UNIQUE_CANDIDATE",
      identityInputHash: "fixture-input-hash",
      authorityPolicyVersion: 1,
      completedAt: new Date(),
    },
  });
  const profile = await prisma.propertyIdentityProfile.create({
    data: {
      stableId: `IREPN-TEST-${suffix.padStart(4, "0")}`,
      propertyObjectId: propertyObject.id,
      createdFromSubmissionId: submission.id,
      subjectScope: "UNIT",
      jurisdiction: "ZZ",
      status: "VERIFIED_INTERNAL",
    },
  });
  const confirmation = await prisma.propertyIdentityAuthorConfirmation.create({
    data: {
      submissionId: submission.id,
      checkRunId: checkRun.id,
      identityProfileId: profile.id,
      confirmedByUserId: user.id,
      resolution: "CREATE_NEW",
      identityInputHash: "fixture-input-hash",
    },
  });

  const cryptoKeyVersion = await prisma.propertyIdentityCryptoKeyVersion.create({
    data: { version: `test-v1-${suffix}`, status: "ACTIVE", activatedAt: new Date() },
  });

  return { organization, market, office, user, propertyObject, submission, checkRun, profile, confirmation, cryptoKeyVersion };
}

describe("Property Identity v4 database invariants", () => {
  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({
        POSTGRES_USER: "kvartal_test",
        POSTGRES_PASSWORD: "kvartal_test",
        POSTGRES_DB: "kvartal_test",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
      .start();
    const url = `postgresql://kvartal_test:kvartal_test@127.0.0.1:${container.getMappedPort(5432)}/kvartal_test?schema=public`;
    await run("pnpm exec prisma migrate deploy --schema prisma/schema.prisma", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url },
    });
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 30_000);

  it("allows only one active digest for a namespaced identifier under concurrent writes", async () => {
    const fixture = await createFoundationFixture();
    const nonce = Buffer.alloc(12, 1);
    const tag = Buffer.alloc(16, 2);
    const ciphertext = Buffer.from("ciphertext");

    const observation = await prisma.propertyIdentifierObservation.create({
      data: {
        submissionId: fixture.submission.id,
        createdByUserId: fixture.user.id,
        scheme: "SYNTHETIC_UNIT_ID",
        subjectScope: "UNIT",
        jurisdiction: "ZZ",
        authorityNamespace: "TEST:UNIT",
        rawValueCiphertext: ciphertext,
        rawValueNonce: nonce,
        rawValueAuthTag: tag,
        normalizedValueCiphertext: ciphertext,
        normalizedValueNonce: nonce,
        normalizedValueAuthTag: tag,
        normalizerId: "synthetic-unit",
        normalizerVersion: 1,
        sourceType: "synthetic_test",
        status: "ACCEPTED",
      },
    });

    const createClaimWithDigest = async (suffix: string) => {
      const claim = await prisma.propertyIdentifierClaim.create({
        data: {
          identityProfileId: fixture.profile.id,
          originObservationId: observation.id,
          scheme: "SYNTHETIC_UNIT_ID",
          subjectScope: "UNIT",
          jurisdiction: "ZZ",
          authorityNamespace: "TEST:UNIT",
          normalizedValueCiphertext: ciphertext,
          normalizedValueNonce: nonce,
          normalizedValueAuthTag: tag,
          normalizerId: "synthetic-unit",
          normalizerVersion: 1,
        },
      });
      return prisma.propertyIdentifierClaimDigest.create({
        data: {
          claimId: claim.id,
          digestKeyVersion: fixture.cryptoKeyVersion.version,
          digest: "same-authoritative-digest",
        },
      }).then((value) => ({ suffix, value }));
    };

    const results = await Promise.allSettled([createClaimWithDigest("a"), createClaimWithDigest("b")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("enforces one current canonical version per identity profile", async () => {
    const fixture = await createFoundationFixture();
    await prisma.propertyCanonicalVersion.create({
      data: {
        identityProfileId: fixture.profile.id,
        versionNumber: 1,
        snapshotJson: { subjectScope: "UNIT", jurisdiction: "ZZ" },
        snapshotHash: "snapshot-1",
        authorConfirmationId: fixture.confirmation.id,
        createdByUserId: fixture.user.id,
      },
    });
    await expect(prisma.propertyCanonicalVersion.create({
      data: {
        identityProfileId: fixture.profile.id,
        versionNumber: 2,
        snapshotJson: { subjectScope: "UNIT", jurisdiction: "ZZ", revision: 2 },
        snapshotHash: "snapshot-2",
        authorConfirmationId: fixture.confirmation.id,
        createdByUserId: fixture.user.id,
      },
    })).rejects.toThrow();
  });

  it("rejects malformed AES-GCM shapes and invalid rollout scope fields", async () => {
    const fixture = await createFoundationFixture();
    await expect(prisma.propertyIdentifierObservation.create({
      data: {
        submissionId: fixture.submission.id,
        createdByUserId: fixture.user.id,
        scheme: "SYNTHETIC_UNIT_ID",
        subjectScope: "UNIT",
        jurisdiction: "ZZ",
        authorityNamespace: "TEST:UNIT",
        rawValueCiphertext: Buffer.from("ciphertext"),
        rawValueNonce: Buffer.alloc(8),
        rawValueAuthTag: Buffer.alloc(16),
        normalizedValueCiphertext: Buffer.from("ciphertext"),
        normalizedValueNonce: Buffer.alloc(12),
        normalizedValueAuthTag: Buffer.alloc(16),
        normalizerId: "synthetic-unit",
        normalizerVersion: 1,
        sourceType: "synthetic_test",
      },
    })).rejects.toThrow();

    await expect(prisma.propertyIdentityRolloutPolicy.create({
      data: {
        scope: "GLOBAL",
        organizationId: fixture.organization.id,
        mode: "NEW_SUBMISSIONS_ONLY",
        registryEnabled: true,
        publishGateEnabled: true,
        configuredByUserId: fixture.user.id,
      },
    })).rejects.toThrow();
  });
});
