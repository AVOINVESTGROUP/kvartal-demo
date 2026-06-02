import { PartnerSitePage } from "../components/PartnerSitePage";
import { fetchPartnerInventoryByLanguage } from "../tenants/api";
import { partnerTenants } from "../tenants";
import { getPartnerTenantByHost } from "../tenants/domains";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const requestHeaders = await headers();
  const tenant = getPartnerTenantByHost(requestHeaders.get("host")) ?? partnerTenants.apart4u;

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
  const tenant = getPartnerTenantByHost(requestHeaders.get("host")) ?? partnerTenants.apart4u;
  const inventoryByLanguage = await fetchPartnerInventoryByLanguage(tenant.key);

  return <PartnerSitePage tenant={tenant} inventoryByLanguage={inventoryByLanguage} />;
}
