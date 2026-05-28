import type { PartnerTenantConfig } from "../types";

export const dubaiTenant: PartnerTenantConfig = {
  key: "dubai",
  name: "Dubai Partner",
  legalLabel: "Future Dubai partner site",
  city: "Dubai",
  country: "UAE",
  domainLabel: "planned Dubai partner domain",
  accentLabel: "Off-plan / Commercial / Cross-border deals",
  tagline: "Future Dubai partner storefront for the shared public inventory and local buyer-side requests.",
  strengths: ["Dubai market intake", "Cross-border inquiries", "Partner network access"],
  inventory: [
    {
      market: "Dubai",
      title: "Off-plan investment object",
      sellerSidePartner: "Dubai partner",
      buyerSidePartner: "Dubai partner",
    },
    {
      market: "Moscow",
      title: "Commercial property",
      sellerSidePartner: "KVARTAL Moscow",
      buyerSidePartner: "Dubai partner",
    },
    {
      market: "Yerevan",
      title: "Regional investment object",
      sellerSidePartner: "Yerevan partner",
      buyerSidePartner: "Dubai partner",
    },
  ],
};
