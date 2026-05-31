import { apart4uTenant } from "./apart4u/config";
import { aurumTenant } from "./aurum/config";
import { dubaiTenant } from "./dubai/config";
import type { PartnerInventoryByLanguage, PartnerInventoryItem, PartnerSiteLanguage, PartnerTenantConfig, PartnerTenantKey } from "./types";
import { yerevanTenant } from "./yerevan/config";

export const partnerTenants = {
  apart4u: apart4uTenant,
  dubai: dubaiTenant,
  yerevan: yerevanTenant,
  aurum: aurumTenant,
} satisfies Record<PartnerTenantKey, PartnerTenantConfig>;

export const partnerTenantKeys = Object.keys(partnerTenants) as PartnerTenantKey[];

export function getPartnerTenant(key: string): PartnerTenantConfig | undefined {
  return partnerTenants[key as PartnerTenantKey];
}

export type { PartnerInventoryByLanguage, PartnerInventoryItem, PartnerSiteLanguage, PartnerTenantConfig, PartnerTenantKey };
