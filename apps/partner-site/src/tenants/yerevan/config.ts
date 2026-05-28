import type { PartnerTenantConfig } from "../types";

export const yerevanTenant: PartnerTenantConfig = {
  key: "yerevan",
  name: "Yerevan Partner",
  legalLabel: "Future Yerevan partner site",
  city: "Yerevan",
  country: "Armenia",
  domainLabel: "planned Yerevan partner domain",
  accentLabel: "Residential / Land / Investment requests",
  tagline: "Future Yerevan partner storefront connected to the shared public inventory and local deal flow.",
  strengths: ["Local buyer intake", "Regional listings", "Partner network access"],
  inventory: [
    {
      market: "Yerevan",
      title: "Residential property",
      sellerSidePartner: "Yerevan partner",
      buyerSidePartner: "Yerevan partner",
    },
    {
      market: "Moscow",
      title: "Land plot",
      sellerSidePartner: "KVARTAL Moscow",
      buyerSidePartner: "Yerevan partner",
    },
    {
      market: "Dubai",
      title: "Investment project",
      sellerSidePartner: "Dubai partner",
      buyerSidePartner: "Yerevan partner",
    },
  ],
};
