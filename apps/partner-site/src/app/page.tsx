import { PartnerSitePage } from "../components/PartnerSitePage";
import { partnerTenants } from "../tenants";

export default function Apart4uSiteHome() {
  return <PartnerSitePage tenant={partnerTenants.apart4u} />;
}
