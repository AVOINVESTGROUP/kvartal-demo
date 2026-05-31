export type PartnerTenantKey = "apart4u" | "dubai" | "yerevan";
export type PartnerSiteLanguage = "ru" | "en" | "ka";

export type PartnerInventoryItem = {
  id?: string;
  market: string;
  city?: string;
  country?: string;
  title: string;
  description?: string;
  addressDisplay?: string;
  assetClass?: string;
  priceDisplay?: string;
  areaSqm?: string | null;
  mediaUrl?: string | null;
  sellerSidePartner: string;
  buyerSidePartner: string;
};

export type PartnerInventoryByLanguage = Partial<Record<PartnerSiteLanguage, PartnerInventoryItem[]>>;

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
