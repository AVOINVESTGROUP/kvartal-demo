import { createServer, type ServerResponse } from "node:http";
import { Prisma, PrismaClient } from "@prisma/client";

export const serviceName = "platform-api";

export const ownedRoutes = [
  "/api/v1/platform/offices",
  "/api/v1/platform/organizations",
  "/api/v1/platform/markets",
  "/api/v1/platform/site-configs",
  "/api/v1/platform/subscriptions",
  "/api/v1/platform/audit",
] as const;

const port = Number(process.env.PORT ?? 8080);
const prisma = new PrismaClient();

type PlatformOrganizationRow = Prisma.OrganizationGetPayload<{
  include: {
    offices: {
      include: {
        defaultMarket: true;
        _count: {
          select: {
            propertyObjects: true;
            clientIntents: true;
          };
        };
      };
    };
    _count: {
      select: {
        offices: true;
        propertyObjects: true;
        clientIntents: true;
      };
    };
  };
}>;

type PlatformOfficeRow = PlatformOrganizationRow["offices"][number];

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
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
      const organizationCount = await prisma.organization.count();
      sendJson(response, 200, {
        ok: result?.ok === 1,
        service: serviceName,
        database: "ready",
        organizationCount,
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

  if (url.pathname === "/api/v1/platform/organizations" && request.method === "GET") {
    const organizations = await prisma.organization.findMany({
      orderBy: { legalName: "asc" },
      include: {
        offices: {
          orderBy: { legalName: "asc" },
          include: {
            defaultMarket: true,
            _count: {
              select: {
                propertyObjects: true,
                clientIntents: true,
              },
            },
          },
        },
        _count: {
          select: {
            offices: true,
            propertyObjects: true,
            clientIntents: true,
          },
        },
      },
    });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      organizations: organizations.map((organization: PlatformOrganizationRow) => ({
        id: organization.id,
        slug: organization.slug,
        legalName: organization.legalName,
        countryOfRegistration: organization.countryOfRegistration,
        operatingCountryCodes: organization.operatingCountryCodes,
        status: organization.status,
        defaultLanguage: organization.defaultLanguage,
        defaultCurrency: organization.defaultCurrency,
        counts: {
          offices: organization._count.offices,
          propertyObjects: organization._count.propertyObjects,
          clientIntents: organization._count.clientIntents,
        },
        offices: organization.offices.map((office: PlatformOfficeRow) => ({
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
      })),
    });
    return;
  }

  if (url.pathname === "/api/v1/platform/summary" && request.method === "GET") {
    const [organizationCount, officeCount, publicObjectCount, totalObjectCount] = await Promise.all([
      prisma.organization.count(),
      prisma.office.count(),
      prisma.propertyObject.count({ where: { status: "published", visibility: "public", canBeShownByOtherOffices: true } }),
      prisma.propertyObject.count(),
    ]);

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      summary: {
        organizationCount,
        officeCount,
        totalObjectCount,
        sharedPublicInventoryCount: publicObjectCount,
        database: "cloud_sql_postgresql",
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
