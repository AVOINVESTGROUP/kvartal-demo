import { createServer } from "node:http";

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

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: serviceName }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      error: {
        code: "not_found",
        message: "Route is not implemented yet.",
        details: { service: serviceName, path: url.pathname },
      },
    }),
  );
});

server.listen(port, () => {
  console.log(`${serviceName} listening on ${port}`);
});
