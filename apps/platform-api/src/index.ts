import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { PrismaClient } from "@prisma/client";
import { firebaseAdminAuth, resolveUserActor, structuredAuthError, type ApiAuthPolicy } from "@kvartal/auth";
import { randomUUID } from "node:crypto";
import { handleExternalIdentityRoute } from "./external-identity.js";

export const serviceName = "platform-api";

export const ownedRoutes = [
  "/api/v1/platform/offices",
  "/api/v1/platform/organizations",
  "/api/v1/platform/markets",
  "/api/v1/platform/site-configs",
  "/api/v1/platform/subscriptions",
  "/api/v1/platform/audit",
  "/api/v1/platform/access",
  "/api/v1/platform/access/members",
  "/api/v1/platform/access/platform-member",
  "/api/v1/platform/access/organization-owner",
  "/api/v1/platform/actor-context",
  "/api/v1/platform/external-identity-binding-requests",
  "/api/v1/platform/external-identities",
] as const;

export const routeAuthPolicies: ReadonlyArray<{ matches: (path: string) => boolean; policy: ApiAuthPolicy }> = [
  { matches: (path) => path === "/healthz" || path === "/readyz", policy: "PUBLIC" },
  { matches: (path) => path === "/api/v1/platform/actor-context" || path.startsWith("/api/v1/platform/external-identit"), policy: "ACTOR_AUTH_REQUIRED" },
  { matches: (path) => path.startsWith("/api/v1/platform/"), policy: "LEGACY_SERVICE_AUTH" },
];

export function authPolicyForPath(path: string) { return routeAuthPolicies.find((entry) => entry.matches(path))?.policy; }

const port = Number(process.env.PORT ?? 8080);
const prisma = new PrismaClient();

type PlatformOfficeRow = {
  id: string;
  slug: string;
  legalName: string;
  city: string;
  country: string;
  status: string;
  defaultMarket: { slug: string; city: string; country: string } | null;
  _count: { propertyObjects: number; clientIntents: number };
};

type PlatformOrganizationRow = {
  id: string;
  slug: string;
  legalName: string;
  countryOfRegistration: string;
  operatingCountryCodes: string[];
  status: string;
  defaultLanguage: string;
  defaultCurrency: string;
  _count: { offices: number; propertyObjects: number; clientIntents: number };
  offices: PlatformOfficeRow[];
};

type AccessPlatformRoleAssignment = {
  active: boolean;
  role: "platform_owner" | "platform_admin" | "platform_analyst" | "platform_viewer";
};

type AccessOrganizationMembership = {
  active: boolean;
  roles: Array<"organization_owner" | "organization_admin">;
  organization: { slug: string; legalName: string };
};

type AccessOfficeMembership = {
  active: boolean;
  roles: Array<"office_owner" | "office_admin" | "broker" | "office_analyst" | "office_viewer">;
  office: { slug: string; legalName: string };
};

type AccessMemberRow = {
  email: string;
  displayName: string | null;
  active: boolean;
  platformRoleAssignments: AccessPlatformRoleAssignment[];
  organizationMemberships: AccessOrganizationMembership[];
};

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

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeEmail(value: unknown) {
  return optionalString(value)?.toLowerCase();
}

function hasPlatformWriteAccess(request: IncomingMessage) {
  const expectedToken = process.env.PLATFORM_WRITE_TOKEN ?? process.env.ADMIN_WRITE_TOKEN;
  const suppliedToken = request.headers["x-kvartal-admin-write-token"];

  if (!expectedToken) {
    return false;
  }

  return typeof suppliedToken === "string" && suppliedToken.trim() === expectedToken.trim();
}

function bootstrapOwnerEmails() {
  return (process.env.FIXER_PLATFORM_OWNER_EMAILS ?? process.env.KVARTAL_PLATFORM_OWNER_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function ensureBootstrapOwner(email: string, displayName?: string) {
  if (!bootstrapOwnerEmails().includes(email.toLowerCase())) {
    return;
  }

  const user = await prisma.appUser.upsert({
    where: { email },
    update: { firebaseUid: `google:${email}`, displayName, active: true },
    create: {
      firebaseUid: `google:${email}`,
      email,
      displayName,
      active: true,
    },
  });

  await prisma.platformRoleAssignment.upsert({
    where: { userId_role: { userId: user.id, role: "platform_owner" } },
    update: { active: true },
    create: { userId: user.id, role: "platform_owner", active: true },
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const correlationId = typeof request.headers["x-correlation-id"] === "string" ? request.headers["x-correlation-id"] : randomUUID();
  const policy = authPolicyForPath(url.pathname);

  if (!policy) {
    sendError(response, 500, "DEPLOYMENT_PREREQUISITE_MISSING", "Route authentication policy is missing.");
    return;
  }

  if (policy === "ACTOR_AUTH_REQUIRED") {
    try {
      const actor = await resolveUserActor({
        authorization: request.headers.authorization,
        correlationId,
        verifySession: (token, checkRevoked) => firebaseAdminAuth().verifySessionCookie(token, checkRevoked),
        findIdentity: async (provider, subject) => prisma.appUserExternalIdentity.findUnique({
          where: { provider_subject: { provider, subject } },
          include: { appUser: { include: { platformRoleAssignments: true, organizationMemberships: true, officeMemberships: true } } },
        }),
      });
      if (url.pathname === "/api/v1/platform/actor-context" && request.method === "GET") { sendJson(response, 200, { actor }); return; }
      if (await handleExternalIdentityRoute(request, response, url, prisma, actor)) return;
    } catch (caught) {
      const error = caught as { code?: string; status?: number; message?: string };
      sendJson(response, error.status ?? 401, structuredAuthError((error.code ?? "REAUTH_REQUIRED") as never, error.message ?? "Sign in again.", correlationId));
      return;
    }
  }

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

  if (url.pathname === "/api/v1/platform/access" && request.method === "GET") {
    const email = normalizeEmail(url.searchParams.get("email"));
    const displayName = optionalString(url.searchParams.get("displayName"));

    if (!email) {
      sendError(response, 400, "email_required", "Email is required.");
      return;
    }

    await ensureBootstrapOwner(email, displayName);

    const user = await prisma.appUser.findUnique({
      where: { email },
      include: {
        platformRoleAssignments: true,
        organizationMemberships: {
          include: {
            organization: true,
          },
        },
        officeMemberships: {
          include: {
            office: true,
          },
        },
      },
    });

    if (!user || !user.active) {
      sendJson(response, 200, {
        ok: true,
        email,
        authorized: false,
        platformRoles: [],
        organizationMemberships: [],
        officeMemberships: [],
      });
      return;
    }

    const platformRoles = user.platformRoleAssignments
      .filter((role: AccessPlatformRoleAssignment) => role.active)
      .map((role: AccessPlatformRoleAssignment) => role.role);

    sendJson(response, 200, {
      ok: true,
      email: user.email,
      displayName: user.displayName,
      authorized: platformRoles.includes("platform_owner") || platformRoles.includes("platform_admin"),
      platformRoles,
      organizationMemberships: (user.organizationMemberships as AccessOrganizationMembership[])
        .filter((membership: AccessOrganizationMembership) => membership.active)
        .map((membership: AccessOrganizationMembership) => ({
          organizationSlug: membership.organization.slug,
          organizationName: membership.organization.legalName,
          roles: membership.roles,
        })),
      officeMemberships: (user.officeMemberships as AccessOfficeMembership[])
        .filter((membership: AccessOfficeMembership) => membership.active)
        .map((membership: AccessOfficeMembership) => ({
          officeSlug: membership.office.slug,
          officeName: membership.office.legalName,
          roles: membership.roles,
        })),
    });
    return;
  }

  if (url.pathname === "/api/v1/platform/access/members" && request.method === "GET") {
    const users = await prisma.appUser.findMany({
      where: {
        OR: [
          { platformRoleAssignments: { some: {} } },
          { organizationMemberships: { some: {} } },
        ],
      },
      include: {
        platformRoleAssignments: true,
        organizationMemberships: {
          include: {
            organization: true,
          },
        },
      },
      orderBy: { email: "asc" },
    });

    sendJson(response, 200, {
      ok: true,
      members: (users as AccessMemberRow[]).map((user) => ({
        email: user.email,
        displayName: user.displayName,
        active: user.active,
        platformRoles: (user.platformRoleAssignments as AccessPlatformRoleAssignment[])
          .filter((role: AccessPlatformRoleAssignment) => role.active)
          .map((role: AccessPlatformRoleAssignment) => role.role),
        inactivePlatformRoles: (user.platformRoleAssignments as AccessPlatformRoleAssignment[])
          .filter((role: AccessPlatformRoleAssignment) => !role.active)
          .map((role: AccessPlatformRoleAssignment) => role.role),
        organizationMemberships: (user.organizationMemberships as AccessOrganizationMembership[]).map((membership) => ({
          organizationSlug: membership.organization.slug,
          organizationName: membership.organization.legalName,
          roles: membership.roles,
          active: membership.active,
        })),
      })),
    });
    return;
  }

  if (url.pathname === "/api/v1/platform/access/platform-member" && request.method === "POST") {
    if (!hasPlatformWriteAccess(request)) {
      sendError(response, 403, "platform_write_forbidden", "Platform write token is missing or invalid.");
      return;
    }

    type Body = {
      email?: string;
      displayName?: string;
      role?: "platform_owner" | "platform_admin" | "platform_analyst" | "platform_viewer";
    };
    const body = await readJsonBody<Body>(request);
    const email = normalizeEmail(body.email);
    const role = (optionalString(body.role) ?? "platform_admin") as "platform_owner" | "platform_admin" | "platform_analyst" | "platform_viewer";

    if (!email) {
      sendError(response, 400, "email_required", "Email is required.");
      return;
    }

    const user = await prisma.appUser.upsert({
      where: { email },
      update: { firebaseUid: `google:${email}`, displayName: optionalString(body.displayName), active: true },
      create: {
        firebaseUid: `google:${email}`,
        email,
        displayName: optionalString(body.displayName),
        active: true,
      },
    });

    const assignment = await prisma.platformRoleAssignment.upsert({
      where: { userId_role: { userId: user.id, role } },
      update: { active: true },
      create: { userId: user.id, role, active: true },
    });

    sendJson(response, 201, {
      ok: true,
      member: {
        email: user.email,
        displayName: user.displayName,
        role: assignment.role,
        active: assignment.active,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/platform/access/platform-member" && request.method === "PATCH") {
    if (!hasPlatformWriteAccess(request)) {
      sendError(response, 403, "platform_write_forbidden", "Platform write token is missing or invalid.");
      return;
    }

    type Body = {
      email?: string;
      displayName?: string;
      role?: "platform_owner" | "platform_admin" | "platform_analyst" | "platform_viewer";
      active?: boolean;
    };
    const body = await readJsonBody<Body>(request);
    const email = normalizeEmail(body.email);
    const role = optionalString(body.role) as Body["role"];
    const active = body.active !== false;

    if (!email || !role) {
      sendError(response, 400, "required_fields_missing", "email and role are required.");
      return;
    }

    const user = await prisma.appUser.upsert({
      where: { email },
      update: { displayName: optionalString(body.displayName), active: true },
      create: {
        firebaseUid: `google:${email}`,
        email,
        displayName: optionalString(body.displayName),
        active: true,
      },
    });

    if (active) {
      await prisma.platformRoleAssignment.updateMany({
        where: { userId: user.id },
        data: { active: false },
      });
    }

    const assignment = await prisma.platformRoleAssignment.upsert({
      where: { userId_role: { userId: user.id, role } },
      update: { active },
      create: { userId: user.id, role, active },
    });

    sendJson(response, 200, {
      ok: true,
      member: {
        email: user.email,
        displayName: user.displayName,
        role: assignment.role,
        active: assignment.active,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/platform/access/organization-owner" && request.method === "POST") {
    if (!hasPlatformWriteAccess(request)) {
      sendError(response, 403, "platform_write_forbidden", "Platform write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      email?: string;
      displayName?: string;
    };
    const body = await readJsonBody<Body>(request);
    const organizationSlug = optionalString(body.organizationSlug);
    const email = normalizeEmail(body.email);

    if (!organizationSlug || !email) {
      sendError(response, 400, "required_fields_missing", "organizationSlug and email are required.");
      return;
    }

    const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const user = await prisma.appUser.upsert({
      where: { email },
      update: { firebaseUid: `google:${email}`, displayName: optionalString(body.displayName), active: true },
      create: {
        firebaseUid: `google:${email}`,
        email,
        displayName: optionalString(body.displayName),
        active: true,
      },
    });

    const membership = await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { roles: ["organization_owner"], active: true },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roles: ["organization_owner"],
        active: true,
      },
    });

    sendJson(response, 201, {
      ok: true,
      member: {
        email: user.email,
        displayName: user.displayName,
        organizationSlug: organization.slug,
        organizationName: organization.legalName,
        roles: membership.roles,
        active: membership.active,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/platform/access/organization-owner" && request.method === "PATCH") {
    if (!hasPlatformWriteAccess(request)) {
      sendError(response, 403, "platform_write_forbidden", "Platform write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      email?: string;
      displayName?: string;
      role?: "organization_owner" | "organization_admin";
      active?: boolean;
    };
    const body = await readJsonBody<Body>(request);
    const organizationSlug = optionalString(body.organizationSlug);
    const email = normalizeEmail(body.email);
    const role = (optionalString(body.role) ?? "organization_owner") as "organization_owner" | "organization_admin";
    const active = body.active !== false;

    if (!organizationSlug || !email) {
      sendError(response, 400, "required_fields_missing", "organizationSlug and email are required.");
      return;
    }

    const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const user = await prisma.appUser.upsert({
      where: { email },
      update: { displayName: optionalString(body.displayName), active: true },
      create: {
        firebaseUid: `google:${email}`,
        email,
        displayName: optionalString(body.displayName),
        active: true,
      },
    });

    const membership = await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { roles: [role], active },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roles: [role],
        active,
      },
    });

    sendJson(response, 200, {
      ok: true,
      member: {
        email: user.email,
        displayName: user.displayName,
        organizationSlug: organization.slug,
        organizationName: organization.legalName,
        roles: membership.roles,
        active: membership.active,
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
