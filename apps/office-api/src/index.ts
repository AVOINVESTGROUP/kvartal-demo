import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const serviceName = "office-api";

export const ownedRoutes = [
  "/api/v1/public/objects",
  "/api/v1/public/client-intents",
  "/api/v1/admin/context",
  "/api/v1/admin/objects",
  "/api/v1/admin/access-settings",
  "/api/v1/admin/partner-objects",
  "/api/v1/admin/partner-object-visibility",
  "/api/v1/admin/members",
  "/api/v1/admin/property-intakes",
  "/api/v1/admin/client-intents",
  "/api/v1/admin/cobroker-requests",
  "/api/v1/admin/deal-rooms",
] as const;

const port = Number(process.env.PORT ?? 8080);
const prisma = new PrismaClient();

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendError(response: ServerResponse, status: number, code: string, message: string) {
  sendJson(response, status, { ok: false, error: { code, message } });
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function decimalToString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalDecimal(value: unknown) {
  const text = optionalString(value);
  return text ? text.replace(",", ".") : undefined;
}

function optionalInteger(value: unknown) {
  const text = optionalString(value);
  return text ? Number.parseInt(text, 10) : undefined;
}

function booleanFromBody(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function tagsFromBody(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return optionalString(value)
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function hasAdminWriteAccess(request: IncomingMessage) {
  const expectedToken = process.env.ADMIN_WRITE_TOKEN;
  const suppliedToken = request.headers["x-kvartal-admin-write-token"];

  if (!expectedToken) {
    return false;
  }

  return typeof suppliedToken === "string" && suppliedToken.trim() === expectedToken.trim();
}

const tenantOrganizationSlugs = {
  kvartal: "kvartal-moscow",
  apart4u: "apart4u-tbilisi",
  dubai: "dubai-partner",
  yerevan: "yerevan-partner",
} as const;

function organizationSlugForTenant(tenant: string) {
  return tenantOrganizationSlugs[tenant as keyof typeof tenantOrganizationSlugs] ?? tenant;
}

type PublicObjectLocalizationRow = {
  language: string;
  title: string;
  description: string | null;
  addressDisplay: string;
  tags: string[];
  priceDisplay: string | null;
};

type PublicObjectMediaRow = {
  url: string;
  kind: string;
};

type PublicObjectRow = {
  id: string;
  assetClass: string;
  market: { slug: string; city: string; country: string };
  localizations: PublicObjectLocalizationRow[];
  areaSqm: unknown;
  landAreaSqm: unknown;
  buildingAreaSqm: unknown;
  priceAmount: unknown;
  priceCurrency: string | null;
  representationSide: string;
  requiresOwnerOfficeApprovalForLead: boolean;
  ownerOrganization: { slug: string; legalName: string };
  ownerOffice: { slug: string; legalName: string };
  informationOwnerOrganization: { slug: string; legalName: string };
  informationOwnerOffice: { slug: string; legalName: string };
  media: PublicObjectMediaRow[];
  publishedAt: Date | null;
};

type AdminOfficeRow = {
  id: string;
  slug: string;
  legalName: string;
  city: string;
  country: string;
  status: string;
  defaultMarket: { slug: string; city: string; country: string } | null;
  _count: { propertyObjects: number; clientIntents: number };
};

type AdminObjectRow = PublicObjectRow & {
  assetSubtype: string | null;
  status: string;
  visibility: string;
  canBeShownByOtherOffices: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AdminReferenceMarketRow = {
  id: string;
  slug: string;
  city: string;
  country: string;
  defaultCurrency: string;
  assetClasses: string[];
};

type AdminReferenceOfficeRow = {
  id: string;
  slug: string;
  legalName: string;
  city: string;
  country: string;
  defaultMarket: AdminReferenceMarketRow | null;
};

type AdminSiteConfigRow = {
  id: string;
  domain: string | null;
  subdomain: string | null;
  showPartnerObjects: boolean;
  active: boolean;
};

type AdminOrganizationMembershipRow = {
  id: string;
  roles: string[];
  active: boolean;
  user: { id: string; email: string; displayName: string | null; active: boolean };
};

function serializeObject(object: PublicObjectRow, language = "ru") {
  const localization =
    object.localizations.find((item: PublicObjectLocalizationRow) => item.language === language) ??
    object.localizations.find((item: PublicObjectLocalizationRow) => item.language === "ru") ??
    object.localizations[0];

  return {
    id: object.id,
    assetClass: object.assetClass,
    market: {
      slug: object.market.slug,
      city: object.market.city,
      country: object.market.country,
    },
    title: localization?.title ?? object.assetClass,
    description: localization?.description ?? null,
    addressDisplay: localization?.addressDisplay ?? null,
    tags: localization?.tags ?? [],
    priceDisplay: localization?.priceDisplay ?? null,
    areaSqm: decimalToString(object.areaSqm),
    landAreaSqm: decimalToString(object.landAreaSqm),
    buildingAreaSqm: decimalToString(object.buildingAreaSqm),
    priceAmount: decimalToString(object.priceAmount),
    priceCurrency: object.priceCurrency,
    representationSide: object.representationSide,
    requiresOwnerOfficeApprovalForLead: object.requiresOwnerOfficeApprovalForLead,
    sellerSide: {
      organizationSlug: object.ownerOrganization.slug,
      organizationName: object.ownerOrganization.legalName,
      officeSlug: object.ownerOffice.slug,
      officeName: object.ownerOffice.legalName,
    },
    informationRightsHolder: {
      organizationSlug: object.informationOwnerOrganization.slug,
      organizationName: object.informationOwnerOrganization.legalName,
      officeSlug: object.informationOwnerOffice.slug,
      officeName: object.informationOwnerOffice.legalName,
    },
    media: object.media.map((media: PublicObjectMediaRow) => ({
      url: media.url,
      kind: media.kind,
    })),
    publishedAt: object.publishedAt?.toISOString() ?? null,
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true, service: serviceName });
    return;
  }

  if (url.pathname === "/readyz") {
    try {
      const [result] = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
      const officeCount = await prisma.office.count();
      sendJson(response, 200, {
        ok: result?.ok === 1,
        service: serviceName,
        database: "ready",
        officeCount,
      });
    } catch (error) {
      sendJson(response, 503, {
        ok: false,
        service: serviceName,
        database: "not_ready",
        error: error instanceof Error ? error.message : "Unknown readiness error",
      });
    }
    return;
  }

  if (url.pathname === "/api/v1/public/objects" && request.method === "GET") {
    const tenant = url.searchParams.get("tenant") ?? "apart4u";
    const ownerSlug = url.searchParams.get("ownerOrganizationSlug");
    const language = url.searchParams.get("language") ?? "ru";
    const take = Math.min(Number(url.searchParams.get("limit") ?? 12), 50);
    const tenantOrganizationSlug = organizationSlugForTenant(tenant);

    const tenantSiteConfig = await prisma.siteConfig.findFirst({
      where: { organization: { slug: tenantOrganizationSlug }, active: true },
      orderBy: { updatedAt: "desc" },
    });
    const hiddenOverrides = await prisma.$queryRaw<Array<{ propertyObjectId: string }>>`
      SELECT svo."propertyObjectId"
      FROM "SiteObjectVisibilityOverride" svo
      JOIN "Organization" o ON o.id = svo."organizationId"
      WHERE o.slug = ${tenantOrganizationSlug} AND svo.hidden = true
    `;
    const hiddenObjectIds = hiddenOverrides.map((item: { propertyObjectId: string }) => item.propertyObjectId);
    const effectiveOwnerSlug = ownerSlug ?? (tenantSiteConfig?.showPartnerObjects === false ? tenantOrganizationSlug : undefined);

    const objects = await prisma.propertyObject.findMany({
      where: {
        status: "published",
        visibility: "public",
        canBeShownByOtherOffices: true,
        ...(hiddenObjectIds.length ? { id: { notIn: hiddenObjectIds } } : {}),
        ...(effectiveOwnerSlug ? { ownerOrganization: { slug: effectiveOwnerSlug } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take,
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: {
          where: { public: true },
          orderBy: { sortOrder: "asc" },
          take: 3,
        },
      },
    });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      tenant,
      tenantOrganizationSlug,
      showPartnerObjects: tenantSiteConfig?.showPartnerObjects ?? true,
      visibilityRule: effectiveOwnerSlug
        ? "status=published AND visibility=public AND canBeShownByOtherOffices=true AND ownerOrganization=tenant"
        : "status=published AND visibility=public AND canBeShownByOtherOffices=true",
      objects: objects.map((object: PublicObjectRow) => serializeObject(object, language)),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/context" && request.method === "GET") {
    const requestedTenant = url.searchParams.get("tenant") ?? "apart4u";
    const organizationSlug =
      url.searchParams.get("organizationSlug") ??
      tenantOrganizationSlugs[requestedTenant as keyof typeof tenantOrganizationSlugs] ??
      "apart4u-tbilisi";

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: {
          include: {
            defaultMarket: true,
            _count: {
              select: {
                propertyObjects: true,
                clientIntents: true,
              },
            },
          },
          orderBy: { legalName: "asc" },
        },
        siteConfigs: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
        memberships: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            propertyObjects: true,
            informationOwnedObjects: true,
            clientIntents: true,
          },
        },
      },
    });

    if (!organization) {
      sendJson(response, 404, {
        ok: false,
        error: {
          code: "organization_not_found",
          message: `Organization '${organizationSlug}' was not found.`,
        },
      });
      return;
    }

    const sharedPublicInventoryCount = await prisma.propertyObject.count({
      where: { status: "published", visibility: "public", canBeShownByOtherOffices: true },
    });
    const siteConfig = (organization.siteConfigs[0] as AdminSiteConfigRow | undefined) ?? null;
    const memberships = organization.memberships as AdminOrganizationMembershipRow[];

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      tenant: requestedTenant,
      organization: {
        id: organization.id,
        slug: organization.slug,
        legalName: organization.legalName,
        countryOfRegistration: organization.countryOfRegistration,
        operatingCountryCodes: organization.operatingCountryCodes,
        status: organization.status,
        defaultLanguage: organization.defaultLanguage,
        defaultCurrency: organization.defaultCurrency,
        siteConfig: {
          domain: siteConfig?.domain ?? null,
          subdomain: siteConfig?.subdomain ?? null,
          showPartnerObjects: siteConfig?.showPartnerObjects ?? true,
          active: siteConfig?.active ?? true,
        },
        counts: {
          ownedObjects: organization._count.propertyObjects,
          informationOwnedObjects: organization._count.informationOwnedObjects,
          clientIntents: organization._count.clientIntents,
          sharedPublicInventory: sharedPublicInventoryCount,
        },
        offices: organization.offices.map((office: AdminOfficeRow) => ({
          id: office.id,
          slug: office.slug,
          legalName: office.legalName,
          city: office.city,
          country: office.country,
          status: office.status,
          defaultMarket: office.defaultMarket
            ? {
                slug: office.defaultMarket.slug,
                city: office.defaultMarket.city,
                country: office.defaultMarket.country,
              }
            : null,
          counts: {
            propertyObjects: office._count.propertyObjects,
            clientIntents: office._count.clientIntents,
          },
        })),
        members: memberships.map((membership) => ({
          id: membership.id,
          email: membership.user.email,
          displayName: membership.user.displayName,
          roles: membership.roles,
          active: membership.active && membership.user.active,
        })),
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/objects" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const language = url.searchParams.get("language") ?? "ru";
    const take = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

    const objects = await prisma.propertyObject.findMany({
      where: {
        ownerOrganization: { slug: organizationSlug },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take,
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: {
          orderBy: { sortOrder: "asc" },
          take: 5,
        },
      },
    });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      organizationSlug,
      scopeRule: "ownerOrganization.slug = requested organization",
      objects: objects.map((object: AdminObjectRow) => ({
        ...serializeObject(object, language),
        titleEn: object.localizations.find((item) => item.language === "en")?.title ?? null,
        descriptionEn: object.localizations.find((item) => item.language === "en")?.description ?? null,
        addressDisplayEn: object.localizations.find((item) => item.language === "en")?.addressDisplay ?? null,
        tagsEn: object.localizations.find((item) => item.language === "en")?.tags ?? [],
        priceDisplayEn: object.localizations.find((item) => item.language === "en")?.priceDisplay ?? null,
        assetSubtype: object.assetSubtype,
        status: object.status,
        visibility: object.visibility,
        canBeShownByOtherOffices: object.canBeShownByOtherOffices,
        mediaCount: object.media.length,
        createdAt: object.createdAt.toISOString(),
        updatedAt: object.updatedAt.toISOString(),
      })),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/reference" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: {
          include: { defaultMarket: true },
          orderBy: { legalName: "asc" },
        },
      },
    });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const markets = await prisma.market.findMany({
      where: { active: true },
      orderBy: [{ country: "asc" }, { city: "asc" }],
    });
    const offices = organization.offices as AdminReferenceOfficeRow[];
    const referenceMarkets = markets as AdminReferenceMarketRow[];

    sendJson(response, 200, {
      ok: true,
      organization: {
        id: organization.id,
        slug: organization.slug,
        legalName: organization.legalName,
      },
      offices: offices.map((office: AdminReferenceOfficeRow) => ({
        id: office.id,
        slug: office.slug,
        legalName: office.legalName,
        city: office.city,
        country: office.country,
        defaultMarketSlug: office.defaultMarket?.slug ?? null,
      })),
      markets: referenceMarkets.map((market: AdminReferenceMarketRow) => ({
        id: market.id,
        slug: market.slug,
        city: market.city,
        country: market.country,
        defaultCurrency: market.defaultCurrency,
        assetClasses: market.assetClasses,
      })),
      assetClasses: [
        "land",
        "apartment",
        "house",
        "warehouse",
        "industrial_site",
        "factory",
        "hotel",
        "office",
        "retail",
        "mixed_use",
        "development_project",
        "investment_project",
        "other",
      ],
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/access-settings" && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type AccessSettingsBody = {
      organizationSlug?: string;
      showPartnerObjects?: unknown;
    };

    const body = await readJsonBody<AccessSettingsBody>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: {
          include: { defaultMarket: true },
          orderBy: { legalName: "asc" },
        },
      },
    });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const offices = organization.offices as AdminReferenceOfficeRow[];
    const office = offices[0];

    if (!office) {
      sendError(response, 400, "office_not_found", `Organization '${organizationSlug}' has no office.`);
      return;
    }

    const existingSiteConfig = await prisma.siteConfig.findFirst({
      where: { organizationId: organization.id },
      orderBy: { updatedAt: "desc" },
    });
    const showPartnerObjects = booleanFromBody(body.showPartnerObjects);
    const siteConfig = existingSiteConfig
      ? await prisma.siteConfig.update({
          where: { id: existingSiteConfig.id },
          data: { showPartnerObjects, active: true },
        })
      : await prisma.siteConfig.create({
          data: {
            organizationId: organization.id,
            officeId: office.id,
            defaultLanguage: organization.defaultLanguage,
            supportedLanguages: organization.supportedLanguages,
            defaultCurrency: organization.defaultCurrency,
            supportedCurrencies: organization.supportedCurrencies,
            primaryMarketIds: office.defaultMarket ? [office.defaultMarket.id] : [],
            showPartnerObjects,
            active: true,
          },
        });

    sendJson(response, 200, {
      ok: true,
      organizationSlug,
      siteConfig: {
        domain: siteConfig.domain,
        subdomain: siteConfig.subdomain,
        showPartnerObjects: siteConfig.showPartnerObjects,
        active: siteConfig.active,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/partner-objects" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const language = url.searchParams.get("language") ?? "ru";
    const take = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);
    const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const objects = await prisma.propertyObject.findMany({
      where: {
        status: "published",
        visibility: "public",
        canBeShownByOtherOffices: true,
        ownerOrganization: { slug: { not: organizationSlug } },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take,
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: {
          where: { public: true },
          orderBy: { sortOrder: "asc" },
          take: 3,
        },
      },
    });
    const visibilityOverrides = await prisma.$queryRaw<Array<{ propertyObjectId: string; hidden: boolean }>>`
      SELECT "propertyObjectId", hidden
      FROM "SiteObjectVisibilityOverride"
      WHERE "organizationId" = ${organization.id}
    `;
    const hiddenByObjectId = new Map(visibilityOverrides.map((override) => [override.propertyObjectId, override.hidden]));

    sendJson(response, 200, {
      ok: true,
      organizationSlug,
      objects: objects.map((object: AdminObjectRow) => ({
        ...serializeObject(object, language),
        status: object.status,
        visibility: object.visibility,
        canBeShownByOtherOffices: object.canBeShownByOtherOffices,
        hiddenOnThisSite: hiddenByObjectId.get(object.id) === true,
        mediaCount: object.media.length,
        updatedAt: object.updatedAt.toISOString(),
      })),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/partner-object-visibility" && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      propertyObjectId?: string;
      hidden?: unknown;
    };

    const body = await readJsonBody<Body>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const propertyObjectId = optionalString(body.propertyObjectId);
    const hidden = booleanFromBody(body.hidden);

    if (!propertyObjectId) {
      sendError(response, 400, "property_object_required", "propertyObjectId is required.");
      return;
    }

    const [organization, propertyObject] = await Promise.all([
      prisma.organization.findUnique({ where: { slug: organizationSlug } }),
      prisma.propertyObject.findUnique({
        where: { id: propertyObjectId },
        include: { ownerOrganization: true },
      }),
    ]);

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    if (!propertyObject) {
      sendError(response, 404, "property_object_not_found", `Property object '${propertyObjectId}' was not found.`);
      return;
    }

    if (propertyObject.ownerOrganization.slug === organizationSlug) {
      sendError(response, 400, "own_object_not_allowed", "Own organization objects are controlled through publication settings, not partner visibility overrides.");
      return;
    }

    await prisma.$executeRaw`
      INSERT INTO "SiteObjectVisibilityOverride" ("id", "organizationId", "propertyObjectId", "hidden", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${organization.id}, ${propertyObjectId}, ${hidden}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("organizationId", "propertyObjectId")
      DO UPDATE SET "hidden" = EXCLUDED."hidden", "updatedAt" = CURRENT_TIMESTAMP
    `;

    sendJson(response, 200, {
      ok: true,
      organizationSlug,
      propertyObjectId,
      hidden,
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/members" && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type CreateMemberBody = {
      organizationSlug?: string;
      email?: string;
      displayName?: string;
      organizationRole?: "organization_owner" | "organization_admin";
      officeSlug?: string;
      officeRole?: "office_owner" | "office_admin" | "broker" | "office_analyst" | "office_viewer";
    };

    const body = await readJsonBody<CreateMemberBody>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const email = optionalString(body.email)?.toLowerCase();

    if (!email) {
      sendError(response, 400, "email_required", "User email is required.");
      return;
    }

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: true,
      },
    });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const user = await prisma.appUser.upsert({
      where: { email },
      update: {
        displayName: optionalString(body.displayName),
        active: true,
      },
      create: {
        firebaseUid: `pending:${email}`,
        email,
        displayName: optionalString(body.displayName),
        active: true,
      },
    });

    const organizationRole = (optionalString(body.organizationRole) ?? "organization_admin") as never;
    const membership = await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: {
        roles: [organizationRole],
        active: true,
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roles: [organizationRole],
        active: true,
      },
    });

    const office = (organization.offices as Array<{ id: string; slug: string }>).find(
      (item: { id: string; slug: string }) => item.slug === optionalString(body.officeSlug),
    );
    const officeRole = optionalString(body.officeRole);

    if (office && officeRole) {
      await prisma.officeMembership.upsert({
        where: { officeId_userId: { officeId: office.id, userId: user.id } },
        update: {
          roles: [officeRole as never],
          active: true,
        },
        create: {
          organizationId: organization.id,
          officeId: office.id,
          userId: user.id,
          roles: [officeRole as never],
          active: true,
        },
      });
    }

    sendJson(response, 201, {
      ok: true,
      member: {
        id: membership.id,
        email: user.email,
        displayName: user.displayName,
        roles: membership.roles,
        active: membership.active && user.active,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/objects" && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type CreateObjectBody = {
      organizationSlug?: string;
      officeSlug?: string;
      marketSlug?: string;
      assetClass?: string;
      assetSubtype?: string;
      status?: string;
      visibility?: string;
      canBeShownByOtherOffices?: unknown;
      title?: string;
      titleEn?: string;
      description?: string;
      descriptionEn?: string;
      addressDisplay?: string;
      addressDisplayEn?: string;
      tags?: unknown;
      tagsEn?: unknown;
      areaSqm?: string;
      landAreaSqm?: string;
      buildingAreaSqm?: string;
      rentableAreaSqm?: string;
      floorNumber?: string;
      floorsTotal?: string;
      roomsCount?: string;
      bedroomsCount?: string;
      bathroomsCount?: string;
      cadastralNumber?: string;
      priceDisplay?: string;
      priceDisplayEn?: string;
      priceAmount?: string;
      priceCurrency?: string;
      mediaUrl?: string;
    };

    const body = await readJsonBody<CreateObjectBody>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const title = optionalString(body.title);
    const addressDisplay = optionalString(body.addressDisplay);

    if (!title || !addressDisplay) {
      sendError(response, 400, "required_fields_missing", "Title and addressDisplay are required.");
      return;
    }

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: {
          include: { defaultMarket: true },
          orderBy: { legalName: "asc" },
        },
      },
    });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const offices = organization.offices as AdminReferenceOfficeRow[];
    const office =
      offices.find((item: AdminReferenceOfficeRow) => item.slug === optionalString(body.officeSlug)) ??
      offices[0];

    if (!office) {
      sendError(response, 400, "office_not_found", `Organization '${organizationSlug}' has no office.`);
      return;
    }

    const market = optionalString(body.marketSlug)
      ? await prisma.market.findUnique({ where: { slug: optionalString(body.marketSlug) } })
      : office.defaultMarket;

    if (!market) {
      sendError(response, 400, "market_not_found", "Market is required.");
      return;
    }

    const createdByUser = await prisma.appUser.upsert({
      where: { firebaseUid: "admin-console-system-user" },
      update: { email: "admin-console@fixer.guru", active: true },
      create: {
        firebaseUid: "admin-console-system-user",
        email: "admin-console@fixer.guru",
        displayName: "KVARTAL Admin Console",
        active: true,
      },
    });

    const status = optionalString(body.status) === "published" ? "published" : "draft";
    const visibility = optionalString(body.visibility) === "public" ? "public" : optionalString(body.visibility) === "office_network" ? "office_network" : "private";
    const mediaUrl = optionalString(body.mediaUrl);

    const propertyObject = await prisma.propertyObject.create({
      data: {
        ownerOrganizationId: organization.id,
        ownerOfficeId: office.id,
        informationOwnerOrganizationId: organization.id,
        informationOwnerOfficeId: office.id,
        createdByUserId: createdByUser.id,
        marketId: market.id,
        status,
        visibility,
        assetClass: (optionalString(body.assetClass) ?? "land") as never,
        assetSubtype: optionalString(body.assetSubtype),
        areaSqm: optionalDecimal(body.areaSqm),
        landAreaSqm: optionalDecimal(body.landAreaSqm),
        buildingAreaSqm: optionalDecimal(body.buildingAreaSqm),
        rentableAreaSqm: optionalDecimal(body.rentableAreaSqm),
        floorNumber: optionalInteger(body.floorNumber),
        floorsTotal: optionalInteger(body.floorsTotal),
        roomsCount: optionalInteger(body.roomsCount),
        bedroomsCount: optionalInteger(body.bedroomsCount),
        bathroomsCount: optionalInteger(body.bathroomsCount),
        cadastralNumber: optionalString(body.cadastralNumber),
        priceMode: optionalDecimal(body.priceAmount) ? "fixed" : "on_request",
        priceAmount: optionalDecimal(body.priceAmount),
        priceCurrency: optionalString(body.priceCurrency) as never,
        representationSide: "seller",
        exclusivity: "unknown",
        canBeShownByOtherOffices: booleanFromBody(body.canBeShownByOtherOffices),
        requiresOwnerOfficeApprovalForLead: true,
        publishedAt: status === "published" ? new Date() : null,
        localizations: {
          create: [
            {
              language: "ru",
              title,
              description: optionalString(body.description),
              addressDisplay,
              tags: tagsFromBody(body.tags),
              priceDisplay: optionalString(body.priceDisplay),
            },
            {
              language: "en",
              title: optionalString(body.titleEn) ?? title,
              description: optionalString(body.descriptionEn) ?? optionalString(body.description),
              addressDisplay: optionalString(body.addressDisplayEn) ?? addressDisplay,
              tags: tagsFromBody(body.tagsEn).length ? tagsFromBody(body.tagsEn) : tagsFromBody(body.tags),
              priceDisplay: optionalString(body.priceDisplayEn) ?? optionalString(body.priceDisplay),
            },
          ],
        },
        ...(mediaUrl
          ? {
              media: {
                create: {
                  ownerOrganizationId: organization.id,
                  ownerOfficeId: office.id,
                  url: mediaUrl,
                  kind: "image",
                  public: true,
                  sortOrder: 10,
                },
              },
            }
          : {}),
      },
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: true,
      },
    });

    sendJson(response, 201, { ok: true, object: serializeObject(propertyObject as AdminObjectRow, "ru") });
    return;
  }

  const objectMatch = url.pathname.match(/^\/api\/v1\/admin\/objects\/([^/]+)$/);

  if (objectMatch && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type UpdateObjectBody = {
      organizationSlug?: string;
      action?: "save" | "publish" | "unpublish" | "archive";
      marketSlug?: string;
      assetClass?: string;
      assetSubtype?: string;
      status?: string;
      visibility?: string;
      canBeShownByOtherOffices?: unknown;
      title?: string;
      titleEn?: string;
      description?: string;
      descriptionEn?: string;
      addressDisplay?: string;
      addressDisplayEn?: string;
      tags?: unknown;
      tagsEn?: unknown;
      areaSqm?: string;
      landAreaSqm?: string;
      buildingAreaSqm?: string;
      rentableAreaSqm?: string;
      cadastralNumber?: string;
      priceDisplay?: string;
      priceDisplayEn?: string;
      priceAmount?: string;
      priceCurrency?: string;
      mediaUrl?: string;
      clearMedia?: unknown;
    };

    const objectId = decodeURIComponent(objectMatch[1]);
    const body = await readJsonBody<UpdateObjectBody>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";

    const existing = await prisma.propertyObject.findFirst({
      where: { id: objectId, ownerOrganization: { slug: organizationSlug } },
      include: {
        ownerOrganization: true,
        ownerOffice: true,
        market: true,
        localizations: true,
      },
    });

    if (!existing) {
      sendError(response, 404, "object_not_found", `Object '${objectId}' was not found for '${organizationSlug}'.`);
      return;
    }

    const market = optionalString(body.marketSlug)
      ? await prisma.market.findUnique({ where: { slug: optionalString(body.marketSlug) } })
      : null;
    const action = body.action ?? "save";
    const status = action === "publish" ? "published" : action === "archive" ? "archived" : action === "unpublish" ? "draft" : optionalString(body.status);
    const visibility = action === "publish" ? "public" : action === "unpublish" ? "private" : optionalString(body.visibility);
    const mediaUrl = optionalString(body.mediaUrl);

    const updated = await prisma.propertyObject.update({
      where: { id: existing.id },
      data: {
        ...(market ? { marketId: market.id } : {}),
        ...(status ? { status: status as never } : {}),
        ...(visibility ? { visibility: visibility as never } : {}),
        ...(action === "publish" ? { publishedAt: new Date(), canBeShownByOtherOffices: true } : {}),
        ...(action === "unpublish" ? { publishedAt: null, canBeShownByOtherOffices: false } : {}),
        ...(action === "archive" ? { publishedAt: null, canBeShownByOtherOffices: false } : {}),
        ...(body.canBeShownByOtherOffices !== undefined && action === "save" ? { canBeShownByOtherOffices: booleanFromBody(body.canBeShownByOtherOffices) } : {}),
        ...(optionalString(body.assetClass) ? { assetClass: optionalString(body.assetClass) as never } : {}),
        assetSubtype: optionalString(body.assetSubtype) ?? null,
        areaSqm: optionalDecimal(body.areaSqm) ?? null,
        landAreaSqm: optionalDecimal(body.landAreaSqm) ?? null,
        buildingAreaSqm: optionalDecimal(body.buildingAreaSqm) ?? null,
        rentableAreaSqm: optionalDecimal(body.rentableAreaSqm) ?? null,
        cadastralNumber: optionalString(body.cadastralNumber) ?? null,
        priceMode: optionalDecimal(body.priceAmount) ? "fixed" : "on_request",
        priceAmount: optionalDecimal(body.priceAmount) ?? null,
        priceCurrency: optionalString(body.priceCurrency) as never,
      },
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (optionalString(body.title) && optionalString(body.addressDisplay)) {
      await prisma.propertyObjectLocalization.upsert({
        where: { propertyObjectId_language: { propertyObjectId: existing.id, language: "ru" } },
        update: {
          title: optionalString(body.title) ?? "",
          description: optionalString(body.description),
          addressDisplay: optionalString(body.addressDisplay) ?? "",
          tags: tagsFromBody(body.tags),
          priceDisplay: optionalString(body.priceDisplay),
        },
        create: {
          propertyObjectId: existing.id,
          language: "ru",
          title: optionalString(body.title) ?? "",
          description: optionalString(body.description),
          addressDisplay: optionalString(body.addressDisplay) ?? "",
          tags: tagsFromBody(body.tags),
          priceDisplay: optionalString(body.priceDisplay),
        },
      });

      await prisma.propertyObjectLocalization.upsert({
        where: { propertyObjectId_language: { propertyObjectId: existing.id, language: "en" } },
        update: {
          title: optionalString(body.titleEn) ?? optionalString(body.title) ?? "",
          description: optionalString(body.descriptionEn) ?? optionalString(body.description),
          addressDisplay: optionalString(body.addressDisplayEn) ?? optionalString(body.addressDisplay) ?? "",
          tags: tagsFromBody(body.tagsEn).length ? tagsFromBody(body.tagsEn) : tagsFromBody(body.tags),
          priceDisplay: optionalString(body.priceDisplayEn) ?? optionalString(body.priceDisplay),
        },
        create: {
          propertyObjectId: existing.id,
          language: "en",
          title: optionalString(body.titleEn) ?? optionalString(body.title) ?? "",
          description: optionalString(body.descriptionEn) ?? optionalString(body.description),
          addressDisplay: optionalString(body.addressDisplayEn) ?? optionalString(body.addressDisplay) ?? "",
          tags: tagsFromBody(body.tagsEn).length ? tagsFromBody(body.tagsEn) : tagsFromBody(body.tags),
          priceDisplay: optionalString(body.priceDisplayEn) ?? optionalString(body.priceDisplay),
        },
      });
    }

    if (booleanFromBody(body.clearMedia) || mediaUrl) {
      await prisma.propertyMedia.deleteMany({ where: { propertyObjectId: existing.id, kind: "image" } });
    }

    if (mediaUrl) {
      await prisma.propertyMedia.create({
        data: {
          propertyObjectId: existing.id,
          ownerOrganizationId: existing.ownerOrganizationId,
          ownerOfficeId: existing.ownerOfficeId,
          url: mediaUrl,
          kind: "image",
          public: true,
          sortOrder: 10,
        },
      });
    }

    sendJson(response, 200, { ok: true, object: serializeObject(updated as AdminObjectRow, "ru") });
    return;
  }

  sendJson(response, 404, {
    error: {
      code: "not_found",
      message: "Route is not implemented yet.",
      details: { service: serviceName, path: url.pathname },
    },
  });
});

server.listen(port, () => {
  console.log(`${serviceName} listening on ${port}`);
});
