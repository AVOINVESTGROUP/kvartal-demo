import { notFound } from "next/navigation";

import { PartnerSitePage } from "../../components/PartnerSitePage";
import { fetchPartnerInventoryByLanguage } from "../../tenants/api";
import { getPartnerTenant, partnerTenantKeys } from "../../tenants";

export const dynamic = "force-dynamic";

type TenantPageProps = {
  params: Promise<{
    tenant: string;
  }>;
};

export function generateStaticParams() {
  return partnerTenantKeys.map((tenant) => ({ tenant }));
}

export async function generateMetadata({ params }: TenantPageProps) {
  const { tenant: tenantKey } = await params;
  const tenant = getPartnerTenant(tenantKey);

  if (!tenant) {
    return {};
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

export default async function TenantPage({ params }: TenantPageProps) {
  const { tenant: tenantKey } = await params;
  const tenant = getPartnerTenant(tenantKey);

  if (!tenant) {
    notFound();
  }

  const inventoryByLanguage = await fetchPartnerInventoryByLanguage(tenant.key);

  return <PartnerSitePage tenant={tenant} inventoryByLanguage={inventoryByLanguage} />;
}
