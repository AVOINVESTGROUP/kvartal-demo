import { PartnerSitePage } from "../components/PartnerSitePage";
import { fetchPartnerInventoryByLanguage } from "../tenants/api";
import { partnerTenants } from "../tenants";

export const dynamic = "force-dynamic";

export default async function Apart4uSiteHome() {
  const inventoryByLanguage = await fetchPartnerInventoryByLanguage("apart4u");

  return <PartnerSitePage tenant={partnerTenants.apart4u} inventoryByLanguage={inventoryByLanguage} />;
}
