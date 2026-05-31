import type { PartnerTenantConfig } from "../types";

export const apart4uTenant: PartnerTenantConfig = {
  key: "apart4u",
  name: "Apart4U",
  legalLabel: "Apart4u.co partner site",
  city: "Tbilisi",
  country: "Georgia",
  domainLabel: "apart4u.co",
  accentLabel: "Apartments / Investments / Real Solutions",
  tagline: "Buyer-side real estate representation in Tbilisi with access to the Fixer.guru partner network.",
  heroImage: "/apart4u/hero-tbilisi.png",
  strengths: ["Premium properties", "Buyer-side representation", "Shared public inventory"],
  inventory: [
    {
      market: "Moscow",
      title: "Commercial property",
      sellerSidePartner: "KVARTAL Moscow",
      buyerSidePartner: "Apart4u.co Tbilisi",
    },
    {
      market: "Dubai",
      title: "Investment project",
      sellerSidePartner: "Dubai partner",
      buyerSidePartner: "Apart4u.co Tbilisi",
    },
    {
      market: "Tbilisi",
      title: "Premium apartment",
      sellerSidePartner: "Apart4u.co Tbilisi",
      buyerSidePartner: "Apart4u.co Tbilisi",
    },
  ],
};
