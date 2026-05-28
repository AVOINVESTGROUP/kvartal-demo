import { createServer, type ServerResponse } from "node:http";
import { PrismaClient } from "@prisma/client";

export const serviceName = "office-api";

export const ownedRoutes = [
  "/api/v1/public/objects",
  "/api/v1/public/client-intents",
  "/api/v1/admin/context",
  "/api/v1/admin/objects",
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

function decimalToString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

const tenantOrganizationSlugs = {
  apart4u: "apart4u-tbilisi",
  dubai: "dubai-partner",
  yerevan: "yerevan-partner",
} as const;

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
    const take = Math.min(Number(url.searchParams.get("limit") ?? 12), 50);

    const objects = await prisma.propertyObject.findMany({
      where: {
        status: "published",
        visibility: "public",
        canBeShownByOtherOffices: true,
        ...(ownerSlug ? { ownerOrganization: { slug: ownerSlug } } : {}),
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
      visibilityRule: "status=published AND visibility=public AND canBeShownByOtherOffices=true",
      objects: objects.map((object) => {
        const localization = object.localizations.find((item) => item.language === "en") ?? object.localizations[0];
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
          media: object.media.map((media) => ({
            url: media.url,
            kind: media.kind,
          })),
          publishedAt: object.publishedAt?.toISOString() ?? null,
        };
      }),
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
        counts: {
          ownedObjects: organization._count.propertyObjects,
          informationOwnedObjects: organization._count.informationOwnedObjects,
          clientIntents: organization._count.clientIntents,
          sharedPublicInventory: sharedPublicInventoryCount,
        },
        offices: organization.offices.map((office) => ({
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
      },
    });
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
