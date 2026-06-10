import { PartnerSitePage } from "../components/PartnerSitePage";
import { fetchPartnerInventoryByLanguage } from "../tenants/api";
import { getPartnerTenantByHost } from "../tenants/domains";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function resolveRequestHost(requestHeaders: Awaited<ReturnType<typeof headers>>) {
  return requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
}

export async function generateMetadata() {
  const requestHeaders = await headers();
  const tenant = getPartnerTenantByHost(resolveRequestHost(requestHeaders));

  if (!tenant) {
    return {
      title: "Partner Site Backend",
      description: "Internal partner-site routing endpoint. Public partner websites are served by custom domains.",
    };
  }

  return {
    title: `${tenant.name} | Partner Network`,
    description: tenant.tagline,
    icons:
      tenant.key === "aurum"
        ? {
            icon: "/aurum/key-mark-light.png",
            shortcut: "/aurum/key-mark-light.png",
            apple: "/aurum/key-mark-light.png",
          }
        : undefined,
  };
}

export default async function PartnerSiteHome() {
  const requestHeaders = await headers();
  const tenant = getPartnerTenantByHost(resolveRequestHost(requestHeaders));

  if (!tenant) {
    return (
      <main className="internal-site-shell">
        <section>
          <p>Fixer.guru partner-site backend</p>
          <h1>Custom domain required</h1>
          <span>Partner websites are routed by their branded domain. This technical App Hosting URL is for rollout checks only.</span>
        </section>
      </main>
    );
  }

  const inventoryByLanguage = await fetchPartnerInventoryByLanguage(tenant.key);

  return <PartnerSitePage tenant={tenant} inventoryByLanguage={inventoryByLanguage} />;
}
