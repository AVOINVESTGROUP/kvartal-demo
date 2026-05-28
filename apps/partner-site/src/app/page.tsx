import { PartnerSitePage } from "../components/PartnerSitePage";
import { fetchPartnerInventory } from "../tenants/api";
import { partnerTenants } from "../tenants";

export const dynamic = "force-dynamic";

export default async function Apart4uSiteHome() {
  const inventory = await fetchPartnerInventory("apart4u");

  return <PartnerSitePage tenant={partnerTenants.apart4u} inventoryOverride={inventory} />;
}
