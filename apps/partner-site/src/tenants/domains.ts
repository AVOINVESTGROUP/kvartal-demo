import { getPartnerTenant } from ".";
import type { PartnerTenantConfig, PartnerTenantKey } from "./types";

const tenantDomains: Record<string, PartnerTenantKey> = {
  "apart4u.co": "apart4u",
  "www.apart4u.co": "apart4u",
  "aurumkey.estate": "aurum",
  "www.aurumkey.estate": "aurum",
  "aurumkeynyc.com": "aurum",
  "www.aurumkeynyc.com": "aurum",
  "huajing.estate": "huajing",
  "www.huajing.estate": "huajing",
};

export function normalizeHost(host: string | null | undefined) {
  return (host ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
}

export function getPartnerTenantByHost(host: string | null | undefined): PartnerTenantConfig | undefined {
  const tenantKey = tenantDomains[normalizeHost(host)];

  return tenantKey ? getPartnerTenant(tenantKey) : undefined;
}

export function getTenantDomainAliases() {
  return tenantDomains;
}
