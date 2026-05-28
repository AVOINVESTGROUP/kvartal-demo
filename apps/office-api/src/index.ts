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
  response.writeHead(status, { "content-type": "application/json" });
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
