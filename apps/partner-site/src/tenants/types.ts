export type PartnerTenantKey = "apart4u" | "dubai" | "yerevan";

export type PartnerInventoryItem = {
  market: string;
  title: string;
  sellerSidePartner: string;
  buyerSidePartner: string;
};

export type PartnerTenantConfig = {
  key: PartnerTenantKey;
  name: string;
  legalLabel: string;
  city: string;
  country: string;
  domainLabel: string;
  accentLabel: string;
  tagline: string;
  heroImage?: string;
  strengths: string[];
  inventory: PartnerInventoryItem[];
};
