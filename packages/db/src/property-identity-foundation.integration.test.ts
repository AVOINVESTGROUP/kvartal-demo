import { exec } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { PrismaClient } from "@prisma/client";
import { handlePropertyIdentityRequest, recordPropertyIdentityDriveDraft } from "../../../apps/office-api/src/property-identity.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

const run = promisify(exec);
let container: StartedTestContainer;
let prisma: PrismaClient;
let fixtureSequence = 0;
type PropertyIdentityActor = Parameters<typeof handlePropertyIdentityRequest>[0]["actor"];

async function callPropertyIdentityApi(input: {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  actor: PropertyIdentityActor;
  headers?: Record<string, string>;
  env?: NodeJS.ProcessEnv;
}) {
  const request = Readable.from(input.body ? [JSON.stringify(input.body)] : []) as unknown as IncomingMessage;
  Object.assign(request, { method: input.method, headers: input.headers ?? {} });
  let status = 0;
  let responseHeaders: Record<string, string> = {};
  let responseBody = "";
  const response = {
    writeHead(nextStatus: number, headers: Record<string, string>) { status = nextStatus; responseHeaders = headers; },
    end(chunk?: string) { responseBody = chunk ?? ""; },
  } as unknown as ServerResponse;
  const url = new URL(input.path, "http://localhost");
  await handlePropertyIdentityRequest({ request, response, url, prisma, actor: input.actor, env: input.env });
  return { status, headers: responseHeaders, body: JSON.parse(responseBody) as Record<string, unknown> };
}

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
        encryptionKeyVersion: fixture.cryptoKeyVersion.version,
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
          encryptionKeyVersion: fixture.cryptoKeyVersion.version,
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

  it("serializes competing finalisations so only one canonical object is created", async () => {
    const fixture = await createFoundationFixture();
    const ciphertext = Buffer.from("canonical-race-ciphertext");
    const nonce = Buffer.alloc(12, 3);
    const tag = Buffer.alloc(16, 4);
    const digest = "a".repeat(64);
    const submissions = await Promise.all(["a", "b"].map((suffix) => prisma.propertyRegistrationSubmission.create({
      data: {
        organizationId: fixture.organization.id,
        officeId: fixture.office.id,
        marketId: fixture.market.id,
        createdByUserId: fixture.user.id,
        subjectScope: "UNIT",
        jurisdiction: "ZZ",
        assetClass: "apartment",
        status: "UNIQUE_CANDIDATE",
        identityInput: { race: suffix },
        lastIdentityInputHash: `race-${suffix}`,
        observations: {
          create: {
            createdByUserId: fixture.user.id,
            scheme: "SYNTHETIC_RACE_ID",
            subjectScope: "UNIT",
            jurisdiction: "ZZ",
            authorityNamespace: "TEST:RACE",
            rawValueCiphertext: ciphertext,
            rawValueNonce: nonce,
            rawValueAuthTag: tag,
            normalizedValueCiphertext: ciphertext,
            normalizedValueNonce: nonce,
            normalizedValueAuthTag: tag,
            encryptionKeyVersion: fixture.cryptoKeyVersion.version,
            normalizerId: "synthetic-race",
            normalizerVersion: 1,
            sourceType: "synthetic_test",
            status: "READY",
          },
        },
      },
      include: { observations: true },
    })));

    const finalise = (submission: typeof submissions[number], suffix: string) => prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${11n})`;
      const existing = await tx.propertyIdentifierClaimDigest.findFirst({
        where: { digestKeyVersion: fixture.cryptoKeyVersion.version, digest, active: true },
      });
      if (existing) throw new Error("IDENTITY_CHANGED_RECHECK_REQUIRED");
      const object = await tx.propertyObject.create({
        data: {
          ownerOrganizationId: fixture.organization.id,
          ownerOfficeId: fixture.office.id,
          informationOwnerOrganizationId: fixture.organization.id,
          informationOwnerOfficeId: fixture.office.id,
          createdByUserId: fixture.user.id,
          marketId: fixture.market.id,
          assetClass: "apartment",
        },
      });
      const profile = await tx.propertyIdentityProfile.create({
        data: {
          stableId: `IREPN-RACE-${suffix}`,
          propertyObjectId: object.id,
          createdFromSubmissionId: submission.id,
          subjectScope: "UNIT",
          jurisdiction: "ZZ",
          status: "VERIFIED_INTERNAL",
        },
      });
      await tx.propertyIdentifierClaim.create({
        data: {
          identityProfileId: profile.id,
          originObservationId: submission.observations[0].id,
          scheme: "SYNTHETIC_RACE_ID",
          subjectScope: "UNIT",
          jurisdiction: "ZZ",
          authorityNamespace: "TEST:RACE",
          normalizedValueCiphertext: ciphertext,
          normalizedValueNonce: nonce,
          normalizedValueAuthTag: tag,
          encryptionKeyVersion: fixture.cryptoKeyVersion.version,
          normalizerId: "synthetic-race",
          normalizerVersion: 1,
          digests: { create: { digestKeyVersion: fixture.cryptoKeyVersion.version, digest } },
        },
      });
      return object.id;
    }, { isolationLevel: "Serializable" });

    const results = await Promise.allSettled([
      finalise(submissions[0], "A"),
      finalise(submissions[1], "B"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.propertyIdentityProfile.count({ where: { stableId: { startsWith: "IREPN-RACE-" } } })).toBe(1);
  });

  it("runs the author-owned create, check and confirm flow and preserves incomplete observations", async () => {
    const fixture = await createFoundationFixture();
    await prisma.propertyIdentityCryptoKeyVersion.updateMany({
      where: { version: { not: fixture.cryptoKeyVersion.version }, status: { in: ["ACTIVE", "RETIRING"] } },
      data: { status: "RETIRED", retiredAt: new Date() },
    });
    await prisma.propertyIdentityRolloutPolicy.create({
      data: {
        scope: "ORGANISATION",
        organizationId: fixture.organization.id,
        mode: "STRICT",
        registryEnabled: true,
        publishGateEnabled: true,
        activationAt: new Date(0),
        configuredByUserId: fixture.user.id,
      },
    });
    await prisma.propertyIdentityAuthorityPolicy.create({
      data: {
        organizationId: fixture.organization.id,
        marketId: fixture.market.id,
        jurisdiction: "ZZ",
        assetClass: "apartment",
        subjectScope: "UNIT",
        identifierScheme: "SYNTHETIC_UNIT_ID",
        authorityNamespacePattern: "TEST:UNIT:*",
        normalizerId: "alphanumeric-v1",
        normalizerVersion: 3,
        automaticExactMatchAllowed: true,
        active: true,
        effectiveFrom: new Date(0),
        version: 7,
        configuredByUserId: fixture.user.id,
      },
    });
    const actor: PropertyIdentityActor = Object.freeze({
      actorType: "USER",
      appUserId: fixture.user.id,
      externalIdentityId: "test-external-identity",
      provider: "FIREBASE",
      subject: "test-firebase-subject",
      platformRoles: Object.freeze([]),
      organizationMemberships: Object.freeze([{ organizationId: fixture.organization.id, roles: Object.freeze(["organization_admin" as const]) }]),
      officeMemberships: Object.freeze([{ organizationId: fixture.organization.id, officeId: fixture.office.id, roles: Object.freeze(["office_admin" as const]) }]),
      correlationId: "property-identity-flow-test",
    });
    const encryptionKey = Buffer.alloc(32, 5);
    const digestKey = Buffer.alloc(32, 6);
    const env = {
      PROPERTY_IDENTITY_ENCRYPTION_KEY_BASE64: encryptionKey.toString("base64"),
      PROPERTY_IDENTITY_ENCRYPTION_KEY_VERSION: fixture.cryptoKeyVersion.version,
      PROPERTY_IDENTITY_DIGEST_KEYS_JSON: JSON.stringify([{ version: fixture.cryptoKeyVersion.version, keyBase64: digestKey.toString("base64") }]),
    } as NodeJS.ProcessEnv;

    const created = await callPropertyIdentityApi({
      method: "POST",
      path: "/api/v1/admin/property-identity/submissions",
      actor,
      env,
      headers: { "idempotency-key": "identity-flow-create-0001" },
      body: {
        organizationId: fixture.organization.id,
        officeId: fixture.office.id,
        marketId: fixture.market.id,
        jurisdiction: "ZZ",
        subjectScope: "UNIT",
        assetClass: "apartment",
        identityInput: { areaSqm: 50, floorNumber: 4 },
        identifiers: [{ scheme: "SYNTHETIC_UNIT_ID", authorityNamespace: "TEST:UNIT:CITY", rawValue: "unit-42" }],
      },
    });
    expect(created.status).toBe(201);
    const submissionId = String(created.body.submissionId);

    const checked = await callPropertyIdentityApi({
      method: "POST",
      path: `/api/v1/admin/property-identity/submissions/${submissionId}/check`,
      actor,
      headers: { "idempotency-key": "identity-flow-check-0001" },
      body: {},
    });
    expect(checked.body).toMatchObject({ outcome: "UNIQUE_CANDIDATE", status: "UNIQUE_CANDIDATE" });

    const confirmed = await callPropertyIdentityApi({
      method: "POST",
      path: `/api/v1/admin/property-identity/submissions/${submissionId}/confirm-create`,
      actor,
      headers: { "idempotency-key": "identity-flow-confirm-0001" },
      body: { checkRunId: checked.body.checkRunId },
    });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(201);
    expect(confirmed.body).toMatchObject({ status: "CLOSED", resolution: "CREATE_NEW" });
    expect(await prisma.propertyIdentityProfile.count({ where: { createdFromSubmissionId: submissionId, status: "VERIFIED_INTERNAL" } })).toBe(1);

    const incomplete = await callPropertyIdentityApi({
      method: "POST",
      path: "/api/v1/admin/property-identity/submissions",
      actor,
      env,
      headers: { "idempotency-key": "identity-flow-create-0002" },
      body: {
        marketId: fixture.market.id,
        jurisdiction: "ZZ",
        subjectScope: "UNIT",
        assetClass: "apartment",
        identityInput: { areaSqm: 60 },
        identifiers: [{ rawValue: "unclassified-raw-value" }],
      },
    });
    expect(incomplete.body.status).toBe("NEEDS_CORRECTION");
    const storedObservation = await prisma.propertyIdentifierObservation.findFirst({ where: { submissionId: String(incomplete.body.submissionId) } });
    expect(storedObservation).toMatchObject({ status: "NEEDS_CORRECTION", correctionReason: "IDENTIFIER_NAMESPACE_REQUIRED", encryptionKeyVersion: fixture.cryptoKeyVersion.version });
    expect(storedObservation?.rawValueCiphertext.toString("utf8")).not.toContain("unclassified-raw-value");

    const incompleteId = String(incomplete.body.submissionId);
    const detail = await callPropertyIdentityApi({ method: "GET", path: `/api/v1/admin/property-identity/submissions/${incompleteId}`, actor });
    const detailSubmission = detail.body.submission as Record<string, unknown>;
    const corrected = await callPropertyIdentityApi({
      method: "PATCH",
      path: `/api/v1/admin/property-identity/submissions/${incompleteId}`,
      actor,
      env,
      headers: { "idempotency-key": "identity-flow-correct-0001", "if-match": `"${detailSubmission.rowVersion}"` },
      body: { identifiers: [{ scheme: "SYNTHETIC_UNIT_ID", authorityNamespace: "TEST:UNIT:CITY", rawValue: "unit-42" }] },
    });
    expect(corrected.body.status).toBe("DRAFT");
    expect(corrected.headers.ETag).toBe(`"${corrected.body.rowVersion}"`);

    const exact = await callPropertyIdentityApi({
      method: "POST",
      path: `/api/v1/admin/property-identity/submissions/${incompleteId}/check`,
      actor,
      headers: { "idempotency-key": "identity-flow-check-0002" },
      body: {},
    });
    expect(exact.body.outcome).toBe("EXACT_EXISTING");
    const linked = await callPropertyIdentityApi({
      method: "POST",
      path: `/api/v1/admin/property-identity/submissions/${incompleteId}/confirm-link`,
      actor,
      headers: { "idempotency-key": "identity-flow-link-0001" },
      body: { checkRunId: exact.body.checkRunId },
    });
    expect(linked.body).toMatchObject({ status: "CLOSED", resolution: "LINK_EXISTING", propertyObjectId: confirmed.body.propertyObjectId });

    const migrationSource = await prisma.propertyObject.create({
      data: {
        ownerOrganizationId: fixture.organization.id,
        ownerOfficeId: fixture.office.id,
        informationOwnerOrganizationId: fixture.organization.id,
        informationOwnerOfficeId: fixture.office.id,
        createdByUserId: fixture.user.id,
        marketId: fixture.market.id,
        assetClass: "apartment",
        addressPrivate: "Legacy object address",
      },
    });
    const objectCountBeforeMigrationConfirmation = await prisma.propertyObject.count();
    const migrationSubmission = await prisma.propertyRegistrationSubmission.create({
      data: {
        organizationId: fixture.organization.id,
        officeId: fixture.office.id,
        marketId: fixture.market.id,
        createdByUserId: fixture.user.id,
        migrationSourcePropertyObjectId: migrationSource.id,
        subjectScope: "UNIT",
        jurisdiction: "ZZ",
        assetClass: "apartment",
        status: "DRAFT",
        identityInput: { addressPrivate: "Legacy object address" },
      },
    });
    const migrationCorrected = await callPropertyIdentityApi({
      method: "PATCH",
      path: `/api/v1/admin/property-identity/submissions/${migrationSubmission.id}`,
      actor,
      env,
      headers: { "idempotency-key": "identity-flow-migration-correct-0001", "if-match": '"1"' },
      body: { identifiers: [{ scheme: "SYNTHETIC_UNIT_ID", authorityNamespace: "TEST:UNIT:CITY", rawValue: "unit-99" }] },
    });
    expect(migrationCorrected.body.status).toBe("DRAFT");
    const migrationChecked = await callPropertyIdentityApi({
      method: "POST",
      path: `/api/v1/admin/property-identity/submissions/${migrationSubmission.id}/check`,
      actor,
      headers: { "idempotency-key": "identity-flow-migration-check-0001" },
      body: {},
    });
    expect(migrationChecked.body.outcome).toBe("UNIQUE_CANDIDATE");
    const migrationConfirmed = await callPropertyIdentityApi({
      method: "POST",
      path: `/api/v1/admin/property-identity/submissions/${migrationSubmission.id}/confirm-create`,
      actor,
      headers: { "idempotency-key": "identity-flow-migration-confirm-0001" },
      body: { checkRunId: migrationChecked.body.checkRunId },
    });
    expect(migrationConfirmed.body).toMatchObject({ status: "CLOSED", resolution: "CREATE_NEW", propertyObjectId: migrationSource.id });
    expect(await prisma.propertyObject.count()).toBe(objectCountBeforeMigrationConfirmation);
    expect(await prisma.propertyIdentityProfile.count({ where: { propertyObjectId: migrationSource.id, status: "VERIFIED_INTERNAL" } })).toBe(1);

    const otherActor = { ...actor, appUserId: "another-user", correlationId: "other-actor" } as PropertyIdentityActor;
    const forbidden = await callPropertyIdentityApi({ method: "GET", path: `/api/v1/admin/property-identity/submissions/${submissionId}`, actor: otherActor });
    expect(forbidden.status).toBe(403);

    const cancellable = await callPropertyIdentityApi({
      method: "POST",
      path: "/api/v1/admin/property-identity/submissions",
      actor,
      env,
      headers: { "idempotency-key": "identity-flow-create-0003" },
      body: { marketId: fixture.market.id, jurisdiction: "ZZ", subjectScope: "UNIT", assetClass: "apartment", identityInput: {}, identifiers: [] },
    });
    const cancelled = await callPropertyIdentityApi({
      method: "POST",
      path: `/api/v1/admin/property-identity/submissions/${String(cancellable.body.submissionId)}/cancel`,
      actor,
      headers: { "idempotency-key": "identity-flow-cancel-0001" },
      body: { reason: "cancelled_by_author" },
    });
    expect(cancelled.body.status).toBe("CANCELLED");

    const aiCandidate = await callPropertyIdentityApi({
      method: "POST",
      path: "/api/v1/admin/property-identity/submissions",
      actor,
      env,
      headers: { "idempotency-key": "identity-flow-create-0004" },
      body: { marketId: fixture.market.id, jurisdiction: "ZZ", subjectScope: "UNIT", assetClass: "apartment", identityInput: {}, identifiers: [] },
    });
    const aiSubmissionId = String(aiCandidate.body.submissionId);
    const aiRequest = Readable.from([]) as unknown as IncomingMessage;
    Object.assign(aiRequest, { method: "POST", headers: { "idempotency-key": "identity-flow-drive-0001" } });
    const recordedDraft = await recordPropertyIdentityDriveDraft({
      prisma,
      actor,
      request: aiRequest,
      submissionId: aiSubmissionId,
      driveFolderUrl: "https://drive.google.com/drive/folders/synthetic-test-folder",
      fileRefs: ["google-drive:synthetic-file"],
      extracted: { title: "AI title", addressDisplay: "AI address", assetClass: "apartment", areaSqm: 77, cadastralNumber: "AI-UNTRUSTED" },
      confidence: "high",
      missingFields: [],
    });
    const appliedDraft = await callPropertyIdentityApi({
      method: "POST",
      path: `/api/v1/admin/property-identity/submissions/${aiSubmissionId}/apply-ai-draft`,
      actor,
      headers: { "idempotency-key": "identity-flow-apply-ai-0001", "if-match": `"${recordedDraft.payload.rowVersion}"` },
      body: {},
    });
    expect(appliedDraft.body).toMatchObject({ status: "DRAFT", acceptedFields: expect.arrayContaining(["title", "addressDisplay", "areaSqm"]) });
    const appliedSubmission = await prisma.propertyRegistrationSubmission.findUnique({ where: { id: aiSubmissionId }, include: { aiDraft: true } });
    expect(appliedSubmission?.identityInput).toMatchObject({ title: "AI title", addressDisplay: "AI address", areaSqm: 77 });
    expect(appliedSubmission?.identityInput).not.toHaveProperty("cadastralNumber");
    expect(appliedSubmission?.aiDraft?.proposedPropertyObject).not.toHaveProperty("cadastralNumber");
    expect(appliedSubmission?.aiDraft?.status).toBe("approved");
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
        encryptionKeyVersion: fixture.cryptoKeyVersion.version,
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
