import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedObjectInput = {
  ownerOrganizationId: string;
  ownerOfficeId: string;
  informationOwnerOrganizationId: string;
  informationOwnerOfficeId: string;
  createdByUserId: string;
  marketId: string;
  assetClass: "land" | "apartment" | "house" | "office" | "industrial_site" | "development_project" | "investment_project";
  assetSubtype?: string;
  areaSqm?: string;
  landAreaSqm?: string;
  buildingAreaSqm?: string;
  priceAmount?: string;
  priceCurrency?: "RUB" | "USD" | "GEL" | "AMD" | "AED";
  cadastralNumber?: string;
  title: string;
  description: string;
  addressDisplay: string;
  tags: string[];
  priceDisplay: string;
  titleEn?: string;
  descriptionEn?: string;
  addressDisplayEn?: string;
  tagsEn?: string[];
  priceDisplayEn?: string;
  titleZh?: string;
  descriptionZh?: string;
  addressDisplayZh?: string;
  tagsZh?: string[];
  priceDisplayZh?: string;
  mediaUrl?: string;
};

async function ensurePublishedObject(input: SeedObjectInput) {
  const existing = await prisma.propertyObject.findFirst({
    where: {
      ownerOfficeId: input.ownerOfficeId,
      localizations: {
        some: {
          language: "ru",
          title: input.title,
        },
      },
    },
    include: { localizations: true },
  });

  const data = {
    ownerOrganizationId: input.ownerOrganizationId,
    ownerOfficeId: input.ownerOfficeId,
    informationOwnerOrganizationId: input.informationOwnerOrganizationId,
    informationOwnerOfficeId: input.informationOwnerOfficeId,
    createdByUserId: input.createdByUserId,
    marketId: input.marketId,
    status: "published" as const,
    visibility: "public" as const,
    assetClass: input.assetClass,
    assetSubtype: input.assetSubtype,
    areaSqm: input.areaSqm,
    landAreaSqm: input.landAreaSqm,
    buildingAreaSqm: input.buildingAreaSqm,
    priceMode: "on_request" as const,
    priceAmount: input.priceAmount,
    priceCurrency: input.priceCurrency,
    cadastralNumber: input.cadastralNumber,
    representationSide: "seller" as const,
    exclusivity: "unknown" as const,
    canBeShownByOtherOffices: true,
    requiresOwnerOfficeApprovalForLead: true,
    publishedAt: new Date("2026-05-28T00:00:00.000Z"),
  };

  const propertyObject = existing
    ? await prisma.propertyObject.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.propertyObject.create({
        data: {
          ...data,
          localizations: {
            create: {
              language: "ru",
              title: input.title,
              description: input.description,
              addressDisplay: input.addressDisplay,
              tags: input.tags,
              priceDisplay: input.priceDisplay,
            },
          },
        },
      });

  await prisma.propertyObjectLocalization.upsert({
    where: { propertyObjectId_language: { propertyObjectId: propertyObject.id, language: "ru" } },
    update: {
      title: input.title,
      description: input.description,
      addressDisplay: input.addressDisplay,
      tags: input.tags,
      priceDisplay: input.priceDisplay,
    },
    create: {
      propertyObjectId: propertyObject.id,
      language: "ru",
      title: input.title,
      description: input.description,
      addressDisplay: input.addressDisplay,
      tags: input.tags,
      priceDisplay: input.priceDisplay,
    },
  });

  await prisma.propertyObjectLocalization.upsert({
    where: { propertyObjectId_language: { propertyObjectId: propertyObject.id, language: "en" } },
    update: {
      title: input.titleEn ?? input.title,
      description: input.descriptionEn ?? input.description,
      addressDisplay: input.addressDisplayEn ?? input.addressDisplay,
      tags: input.tagsEn ?? input.tags,
      priceDisplay: input.priceDisplayEn ?? input.priceDisplay,
    },
    create: {
      propertyObjectId: propertyObject.id,
      language: "en",
      title: input.titleEn ?? input.title,
      description: input.descriptionEn ?? input.description,
      addressDisplay: input.addressDisplayEn ?? input.addressDisplay,
      tags: input.tagsEn ?? input.tags,
      priceDisplay: input.priceDisplayEn ?? input.priceDisplay,
    },
  });

  if (input.titleZh) {
    await prisma.propertyObjectLocalization.upsert({
      where: { propertyObjectId_language: { propertyObjectId: propertyObject.id, language: "zh" } },
      update: {
        title: input.titleZh,
        description: input.descriptionZh ?? input.descriptionEn ?? input.description,
        addressDisplay: input.addressDisplayZh ?? input.addressDisplayEn ?? input.addressDisplay,
        tags: input.tagsZh ?? input.tagsEn ?? input.tags,
        priceDisplay: input.priceDisplayZh ?? input.priceDisplayEn ?? input.priceDisplay,
      },
      create: {
        propertyObjectId: propertyObject.id,
        language: "zh",
        title: input.titleZh,
        description: input.descriptionZh ?? input.descriptionEn ?? input.description,
        addressDisplay: input.addressDisplayZh ?? input.addressDisplayEn ?? input.addressDisplay,
        tags: input.tagsZh ?? input.tagsEn ?? input.tags,
        priceDisplay: input.priceDisplayZh ?? input.priceDisplayEn ?? input.priceDisplay,
      },
    });
  }

  await prisma.propertyMedia.deleteMany({ where: { propertyObjectId: propertyObject.id, kind: "image" } });

  if (input.mediaUrl) {
    await prisma.propertyMedia.create({
      data: {
        propertyObjectId: propertyObject.id,
        ownerOrganizationId: input.ownerOrganizationId,
        ownerOfficeId: input.ownerOfficeId,
        url: input.mediaUrl,
        kind: "image",
        public: true,
        sortOrder: 10,
      },
    });
  }

  return propertyObject;
}

async function ensureSiteConfig(input: {
  organizationId: string;
  officeId: string;
  domain?: string;
  subdomain?: string;
  defaultLanguage: "ru" | "en" | "zh" | "ka" | "hy" | "ar";
  supportedLanguages: Array<"ru" | "en" | "zh" | "ka" | "hy" | "ar">;
  defaultCurrency: "RUB" | "USD" | "EUR" | "GEL" | "AMD" | "AED";
  supportedCurrencies: Array<"RUB" | "USD" | "EUR" | "GEL" | "AMD" | "AED">;
  primaryMarketIds: string[];
  contactEmail?: string;
  contactPhone?: string;
  brandName: string;
}) {
  const existing = await prisma.siteConfig.findFirst({
    where: { organizationId: input.organizationId, officeId: input.officeId },
  });
  const data = {
    domain: input.domain,
    subdomain: input.subdomain,
    defaultLanguage: input.defaultLanguage,
    supportedLanguages: input.supportedLanguages,
    defaultCurrency: input.defaultCurrency,
    supportedCurrencies: input.supportedCurrencies,
    primaryMarketIds: input.primaryMarketIds,
    showPartnerObjects: true,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    active: true,
  };
  const siteConfig = existing
    ? await prisma.siteConfig.update({ where: { id: existing.id }, data })
    : await prisma.siteConfig.create({
        data: {
          organizationId: input.organizationId,
          officeId: input.officeId,
          ...data,
        },
      });

  await prisma.siteConfigLocalization.upsert({
    where: { siteConfigId_language: { siteConfigId: siteConfig.id, language: input.defaultLanguage } },
    update: { brandName: input.brandName },
    create: { siteConfigId: siteConfig.id, language: input.defaultLanguage, brandName: input.brandName },
  });

  return siteConfig;
}

async function main() {
  const moscowMarket = await prisma.market.upsert({
    where: { slug: "moscow-commercial" },
    update: {
      active: true,
      assetClasses: ["land", "apartment", "house", "office", "retail", "warehouse", "industrial_site", "factory"],
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "moscow-commercial",
      city: "Moscow",
      country: "RU",
      defaultCurrency: "RUB",
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
      assetClasses: ["land", "apartment", "house", "office", "retail", "warehouse", "industrial_site", "factory"],
      complianceRegion: "RU",
      active: true,
    },
  });

  const batayskMarket = await prisma.market.upsert({
    where: { slug: "bataysk-industrial" },
    update: {
      active: true,
      assetClasses: ["warehouse", "industrial_site", "factory"],
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "bataysk-industrial",
      city: "Bataysk",
      country: "RU",
      defaultCurrency: "RUB",
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
      assetClasses: ["warehouse", "industrial_site", "factory"],
      complianceRegion: "RU",
      active: true,
    },
  });

  const siriusMarket = await prisma.market.upsert({
    where: { slug: "sirius-hospitality" },
    update: {
      active: true,
      assetClasses: ["land", "hotel", "development_project", "investment_project"],
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "sirius-hospitality",
      city: "Sirius",
      country: "RU",
      defaultCurrency: "RUB",
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
      assetClasses: ["land", "hotel", "development_project", "investment_project"],
      complianceRegion: "RU",
      active: true,
    },
  });

  const domodedovoMarket = await prisma.market.upsert({
    where: { slug: "domodedovo-land" },
    update: {
      active: true,
      assetClasses: ["land", "retail", "development_project"],
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "domodedovo-land",
      city: "Domodedovo",
      country: "RU",
      defaultCurrency: "RUB",
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
      assetClasses: ["land", "retail", "development_project"],
      complianceRegion: "RU",
      active: true,
    },
  });

  const kubinkaMarket = await prisma.market.upsert({
    where: { slug: "kubinka-land" },
    update: {
      active: true,
      assetClasses: ["land", "retail", "development_project"],
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "kubinka-land",
      city: "Kubinka",
      country: "RU",
      defaultCurrency: "RUB",
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
      assetClasses: ["land", "retail", "development_project"],
      complianceRegion: "RU",
      active: true,
    },
  });

  const istraMarket = await prisma.market.upsert({
    where: { slug: "istra-land" },
    update: {
      active: true,
      assetClasses: ["land", "development_project"],
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "istra-land",
      city: "Istra",
      country: "RU",
      defaultCurrency: "RUB",
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
      assetClasses: ["land", "development_project"],
      complianceRegion: "RU",
      active: true,
    },
  });

  const tbilisiMarket = await prisma.market.upsert({
    where: { slug: "tbilisi-real-estate" },
    update: {
      active: true,
      assetClasses: ["land", "apartment", "house", "hotel", "mixed_use", "investment_project"],
      supportedCurrencies: ["GEL", "USD"],
      supportedLanguages: ["ru", "en", "ka"],
    },
    create: {
      slug: "tbilisi-real-estate",
      city: "Tbilisi",
      country: "GE",
      defaultCurrency: "USD",
      supportedCurrencies: ["GEL", "USD"],
      supportedLanguages: ["ru", "en", "ka"],
      assetClasses: ["land", "apartment", "house", "hotel", "mixed_use", "investment_project"],
      complianceRegion: "GE",
      active: true,
    },
  });

  const dubaiMarket = await prisma.market.upsert({
    where: { slug: "dubai-investment" },
    update: {
      active: true,
      assetClasses: ["land", "apartment", "house", "hotel", "office", "retail", "development_project", "investment_project"],
      supportedCurrencies: ["AED", "USD"],
      supportedLanguages: ["ru", "en", "ar"],
    },
    create: {
      slug: "dubai-investment",
      city: "Dubai",
      country: "AE",
      defaultCurrency: "AED",
      supportedCurrencies: ["AED", "USD"],
      supportedLanguages: ["ru", "en", "ar"],
      assetClasses: ["land", "apartment", "house", "hotel", "office", "retail", "development_project", "investment_project"],
      complianceRegion: "AE",
      active: true,
    },
  });

  const yerevanMarket = await prisma.market.upsert({
    where: { slug: "yerevan-real-estate" },
    update: {
      active: true,
      assetClasses: ["land", "apartment", "house", "hotel", "mixed_use", "investment_project"],
      supportedCurrencies: ["AMD", "USD"],
      supportedLanguages: ["ru", "en", "hy"],
    },
    create: {
      slug: "yerevan-real-estate",
      city: "Yerevan",
      country: "AM",
      defaultCurrency: "USD",
      supportedCurrencies: ["AMD", "USD"],
      supportedLanguages: ["ru", "en", "hy"],
      assetClasses: ["land", "apartment", "house", "hotel", "mixed_use", "investment_project"],
      complianceRegion: "AM",
      active: true,
    },
  });

  const newYorkMarket = await prisma.market.upsert({
    where: { slug: "new-york-residential" },
    update: {
      active: true,
      assetClasses: ["apartment", "house", "office", "retail", "mixed_use", "investment_project"],
      supportedCurrencies: ["USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "new-york-residential",
      city: "New York",
      country: "US",
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      supportedLanguages: ["ru", "en"],
      assetClasses: ["apartment", "house", "office", "retail", "mixed_use", "investment_project"],
      complianceRegion: "US-NY",
      active: true,
    },
  });

  const shanghaiMarket = await prisma.market.upsert({
    where: { slug: "shanghai-residential" },
    update: {
      active: true,
      assetClasses: ["apartment", "house", "investment_project"],
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
    },
    create: {
      slug: "shanghai-residential",
      city: "Shanghai",
      country: "CN",
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
      assetClasses: ["apartment", "house", "investment_project"],
      complianceRegion: "CN-SH",
      active: true,
    },
  });

  const shenzhenMarket = await prisma.market.upsert({
    where: { slug: "shenzhen-residential" },
    update: {
      active: true,
      assetClasses: ["apartment", "house", "investment_project"],
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
    },
    create: {
      slug: "shenzhen-residential",
      city: "Shenzhen",
      country: "CN",
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
      assetClasses: ["apartment", "house", "investment_project"],
      complianceRegion: "CN-GD",
      active: true,
    },
  });

  const hangzhouMarket = await prisma.market.upsert({
    where: { slug: "hangzhou-residential" },
    update: {
      active: true,
      assetClasses: ["apartment", "house", "investment_project"],
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
    },
    create: {
      slug: "hangzhou-residential",
      city: "Hangzhou",
      country: "CN",
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
      assetClasses: ["apartment", "house", "investment_project"],
      complianceRegion: "CN-ZJ",
      active: true,
    },
  });

  const singaporeMarket = await prisma.market.upsert({
    where: { slug: "singapore-central-residential" },
    update: {
      active: true,
      assetClasses: ["apartment", "investment_project"],
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
    },
    create: {
      slug: "singapore-central-residential",
      city: "Singapore",
      country: "SG",
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
      assetClasses: ["apartment", "investment_project"],
      complianceRegion: "SG",
      active: true,
    },
  });

  const tokyoMarket = await prisma.market.upsert({
    where: { slug: "tokyo-aoyama-residential" },
    update: {
      active: true,
      assetClasses: ["apartment", "investment_project"],
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
    },
    create: {
      slug: "tokyo-aoyama-residential",
      city: "Tokyo",
      country: "JP",
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      supportedLanguages: ["zh", "en", "ru"],
      assetClasses: ["apartment", "investment_project"],
      complianceRegion: "JP-TK",
      active: true,
    },
  });

  const fixer = await prisma.organization.upsert({
    where: { slug: "fixer-guru" },
    update: {
      status: "active",
      operatingCountryCodes: ["RU", "GE", "AE"],
      supportedCurrencies: ["USD", "EUR", "RUB", "GEL", "AED"],
      supportedLanguages: ["ru", "en", "ka", "ar"],
    },
    create: {
      slug: "fixer-guru",
      legalName: "Fixer.guru",
      countryOfRegistration: "AE",
      operatingCountryCodes: ["RU", "GE", "AE"],
      defaultLanguage: "ru",
      supportedLanguages: ["ru", "en", "ka", "ar"],
      defaultCurrency: "USD",
      supportedCurrencies: ["USD", "EUR", "RUB", "GEL", "AED"],
      status: "active",
    },
  });

  const kvartal = await prisma.organization.upsert({
    where: { slug: "kvartal-moscow" },
    update: {
      status: "active",
      operatingCountryCodes: ["RU"],
      supportedCurrencies: ["RUB", "USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "kvartal-moscow",
      legalName: "KVARTAL Moscow",
      countryOfRegistration: "RU",
      operatingCountryCodes: ["RU"],
      defaultLanguage: "ru",
      supportedLanguages: ["ru", "en"],
      defaultCurrency: "RUB",
      supportedCurrencies: ["RUB", "USD"],
      status: "active",
    },
  });

  const apart4u = await prisma.organization.upsert({
    where: { slug: "apart4u-tbilisi" },
    update: {
      status: "active",
      operatingCountryCodes: ["GE"],
      supportedCurrencies: ["GEL", "USD"],
      supportedLanguages: ["ru", "en", "ka"],
    },
    create: {
      slug: "apart4u-tbilisi",
      legalName: "Apart4u.co Tbilisi",
      countryOfRegistration: "GE",
      operatingCountryCodes: ["GE"],
      defaultLanguage: "ru",
      supportedLanguages: ["ru", "en", "ka"],
      defaultCurrency: "USD",
      supportedCurrencies: ["GEL", "USD"],
      status: "active",
    },
  });

  const dubaiPartner = await prisma.organization.upsert({
    where: { slug: "dubai-partner" },
    update: {
      status: "active",
      operatingCountryCodes: ["AE"],
      supportedCurrencies: ["AED", "USD"],
      supportedLanguages: ["ru", "en", "ar"],
    },
    create: {
      slug: "dubai-partner",
      legalName: "Dubai Partner",
      countryOfRegistration: "AE",
      operatingCountryCodes: ["AE"],
      defaultLanguage: "en",
      supportedLanguages: ["ru", "en", "ar"],
      defaultCurrency: "AED",
      supportedCurrencies: ["AED", "USD"],
      status: "active",
    },
  });

  const yerevanPartner = await prisma.organization.upsert({
    where: { slug: "yerevan-partner" },
    update: {
      status: "active",
      operatingCountryCodes: ["AM"],
      supportedCurrencies: ["AMD", "USD"],
      supportedLanguages: ["ru", "en", "hy"],
    },
    create: {
      slug: "yerevan-partner",
      legalName: "Yerevan Partner",
      countryOfRegistration: "AM",
      operatingCountryCodes: ["AM"],
      defaultLanguage: "ru",
      supportedLanguages: ["ru", "en", "hy"],
      defaultCurrency: "USD",
      supportedCurrencies: ["AMD", "USD"],
      status: "active",
    },
  });

  const aurumKey = await prisma.organization.upsert({
    where: { slug: "aurum-key-nyc" },
    update: {
      status: "active",
      operatingCountryCodes: ["US"],
      supportedCurrencies: ["USD"],
      supportedLanguages: ["ru", "en"],
    },
    create: {
      slug: "aurum-key-nyc",
      legalName: "Aurum Key Realty NYC",
      countryOfRegistration: "US",
      operatingCountryCodes: ["US"],
      defaultLanguage: "en",
      supportedLanguages: ["ru", "en"],
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      status: "active",
    },
  });

  const huajing = await prisma.organization.upsert({
    where: { slug: "huajing-estate" },
    update: {
      status: "active",
      operatingCountryCodes: ["CN", "AE", "SG", "JP"],
      supportedCurrencies: ["USD", "AED"],
      supportedLanguages: ["zh", "en", "ru"],
    },
    create: {
      slug: "huajing-estate",
      legalName: "HUAJING Estate Partners",
      countryOfRegistration: "CN",
      operatingCountryCodes: ["CN", "AE", "SG", "JP"],
      defaultLanguage: "zh",
      supportedLanguages: ["zh", "en", "ru"],
      defaultCurrency: "USD",
      supportedCurrencies: ["USD", "AED"],
      status: "active",
    },
  });

  const platformOffice = await prisma.office.upsert({
    where: { organizationId_slug: { organizationId: fixer.id, slug: "platform-operator" } },
    update: { status: "active", defaultMarketId: dubaiMarket.id },
    create: {
      organizationId: fixer.id,
      slug: "platform-operator",
      legalName: "Fixer.guru Platform Operator",
      city: "Dubai",
      country: "AE",
      defaultMarketId: dubaiMarket.id,
      defaultLanguage: "ru",
      supportedLanguages: ["ru", "en", "ar"],
      defaultCurrency: "USD",
      supportedCurrencies: ["USD", "AED"],
      status: "active",
    },
  });

  const kvartalOffice = await prisma.office.upsert({
    where: { organizationId_slug: { organizationId: kvartal.id, slug: "moscow-office" } },
    update: { status: "active", defaultMarketId: moscowMarket.id },
    create: {
      organizationId: kvartal.id,
      slug: "moscow-office",
      legalName: "KVARTAL Moscow Office",
      city: "Moscow",
      country: "RU",
      defaultMarketId: moscowMarket.id,
      defaultLanguage: "ru",
      supportedLanguages: ["ru", "en"],
      defaultCurrency: "RUB",
      supportedCurrencies: ["RUB", "USD"],
      status: "active",
    },
  });

  const apart4uOffice = await prisma.office.upsert({
    where: { organizationId_slug: { organizationId: apart4u.id, slug: "tbilisi-office" } },
    update: { status: "active", defaultMarketId: tbilisiMarket.id },
    create: {
      organizationId: apart4u.id,
      slug: "tbilisi-office",
      legalName: "Apart4u.co Tbilisi Office",
      city: "Tbilisi",
      country: "GE",
      defaultMarketId: tbilisiMarket.id,
      defaultLanguage: "ru",
      supportedLanguages: ["ru", "en", "ka"],
      defaultCurrency: "USD",
      supportedCurrencies: ["GEL", "USD"],
      status: "active",
    },
  });

  const dubaiOffice = await prisma.office.upsert({
    where: { organizationId_slug: { organizationId: dubaiPartner.id, slug: "dubai-office" } },
    update: { status: "active", defaultMarketId: dubaiMarket.id },
    create: {
      organizationId: dubaiPartner.id,
      slug: "dubai-office",
      legalName: "Dubai Partner Office",
      city: "Dubai",
      country: "AE",
      defaultMarketId: dubaiMarket.id,
      defaultLanguage: "en",
      supportedLanguages: ["ru", "en", "ar"],
      defaultCurrency: "AED",
      supportedCurrencies: ["AED", "USD"],
      status: "active",
    },
  });

  const yerevanOffice = await prisma.office.upsert({
    where: { organizationId_slug: { organizationId: yerevanPartner.id, slug: "yerevan-office" } },
    update: { status: "active", defaultMarketId: yerevanMarket.id },
    create: {
      organizationId: yerevanPartner.id,
      slug: "yerevan-office",
      legalName: "Yerevan Partner Office",
      city: "Yerevan",
      country: "AM",
      defaultMarketId: yerevanMarket.id,
      defaultLanguage: "ru",
      supportedLanguages: ["ru", "en", "hy"],
      defaultCurrency: "USD",
      supportedCurrencies: ["AMD", "USD"],
      status: "active",
    },
  });

  const aurumOffice = await prisma.office.upsert({
    where: { organizationId_slug: { organizationId: aurumKey.id, slug: "nyc-office" } },
    update: { status: "active", defaultMarketId: newYorkMarket.id },
    create: {
      organizationId: aurumKey.id,
      slug: "nyc-office",
      legalName: "Aurum Key NYC Office",
      city: "New York",
      country: "US",
      defaultMarketId: newYorkMarket.id,
      defaultLanguage: "en",
      supportedLanguages: ["ru", "en"],
      defaultCurrency: "USD",
      supportedCurrencies: ["USD"],
      status: "active",
    },
  });

  const huajingOffice = await prisma.office.upsert({
    where: { organizationId_slug: { organizationId: huajing.id, slug: "shanghai-office" } },
    update: { status: "active", defaultMarketId: shanghaiMarket.id },
    create: {
      organizationId: huajing.id,
      slug: "shanghai-office",
      legalName: "HUAJING Shanghai Office",
      city: "Shanghai",
      country: "CN",
      defaultMarketId: shanghaiMarket.id,
      defaultLanguage: "zh",
      supportedLanguages: ["zh", "en", "ru"],
      defaultCurrency: "USD",
      supportedCurrencies: ["USD", "AED"],
      status: "active",
    },
  });

  await ensureSiteConfig({
    organizationId: aurumKey.id,
    officeId: aurumOffice.id,
    domain: "aurumkeynyc.com",
    subdomain: "aurum",
    defaultLanguage: "en",
    supportedLanguages: ["ru", "en"],
    defaultCurrency: "USD",
    supportedCurrencies: ["USD"],
    primaryMarketIds: [newYorkMarket.id],
    contactEmail: "hello@aurumkeynyc.com",
    contactPhone: "+1 212 555 0126",
    brandName: "Aurum Key Realty NYC",
  });

  await ensureSiteConfig({
    organizationId: huajing.id,
    officeId: huajingOffice.id,
    domain: "huajing.estate",
    subdomain: "huajing",
    defaultLanguage: "zh",
    supportedLanguages: ["zh", "en", "ru"],
    defaultCurrency: "USD",
    supportedCurrencies: ["USD", "AED"],
    primaryMarketIds: [shanghaiMarket.id, shenzhenMarket.id, hangzhouMarket.id, dubaiMarket.id, singaporeMarket.id, tokyoMarket.id],
    contactEmail: "contact@huajing.estate",
    contactPhone: "+86 21 5550 2026",
    brandName: "华境置业 HUAJING Estate Partners",
  });

  const seedUser = await prisma.appUser.upsert({
    where: { firebaseUid: "seed-system-user" },
    update: { email: "seed-system@fixer.guru", active: true },
    create: {
      firebaseUid: "seed-system-user",
      email: "seed-system@fixer.guru",
      displayName: "KVARTAL Seed System",
      active: true,
    },
  });

  const aurumOwner = await prisma.appUser.upsert({
    where: { email: "abtiurin@gmail.com" },
    update: { displayName: "Aurum Key Owner", active: true },
    create: {
      firebaseUid: "google:abtiurin@gmail.com",
      email: "abtiurin@gmail.com",
      displayName: "Aurum Key Owner",
      active: true,
    },
  });

  await prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId: aurumKey.id, userId: aurumOwner.id } },
    update: { roles: ["organization_owner"], active: true },
    create: {
      organizationId: aurumKey.id,
      userId: aurumOwner.id,
      roles: ["organization_owner"],
      active: true,
    },
  });

  await prisma.officeMembership.upsert({
    where: { officeId_userId: { officeId: aurumOffice.id, userId: aurumOwner.id } },
    update: { roles: ["office_owner", "office_admin", "broker"], active: true },
    create: {
      organizationId: aurumKey.id,
      officeId: aurumOffice.id,
      userId: aurumOwner.id,
      roles: ["office_owner", "office_admin", "broker"],
      active: true,
    },
  });

  await ensurePublishedObject({
    ownerOrganizationId: kvartal.id,
    ownerOfficeId: kvartalOffice.id,
    informationOwnerOrganizationId: kvartal.id,
    informationOwnerOfficeId: kvartalOffice.id,
    createdByUserId: seedUser.id,
    marketId: moscowMarket.id,
    assetClass: "office",
    areaSqm: "420.00",
    priceCurrency: "RUB",
    title: "Коммерческий объект в Москве",
    description: "Опубликованный объект KVARTAL Moscow для показа в партнерской сети.",
    addressDisplay: "Москва, коммерческий район",
    tags: ["Коммерция", "Москва", "Сторона продавца"],
    priceDisplay: "По запросу",
    titleEn: "Moscow commercial property",
    descriptionEn: "Published seller-side object from KVARTAL Moscow for partner network display.",
    addressDisplayEn: "Moscow, commercial district",
    tagsEn: ["commercial", "moscow", "seller-side"],
    priceDisplayEn: "Price on request",
    mediaUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: aurumKey.id,
    ownerOfficeId: aurumOffice.id,
    informationOwnerOrganizationId: aurumKey.id,
    informationOwnerOfficeId: aurumOffice.id,
    createdByUserId: seedUser.id,
    marketId: newYorkMarket.id,
    assetClass: "apartment",
    assetSubtype: "condo loft",
    areaSqm: "150.50",
    priceAmount: "2950000.00",
    priceCurrency: "USD",
    title: "Tribeca Loft Residence",
    description: "High ceilings, full-service building, refined renovation, strong downtown liquidity.",
    addressDisplay: "Tribeca, Manhattan",
    tags: ["Tribeca", "Condo", "Loft"],
    priceDisplay: "$2.95M",
    titleEn: "Tribeca Loft Residence",
    descriptionEn: "High ceilings, full-service building, refined renovation, strong downtown liquidity.",
    addressDisplayEn: "Tribeca, Manhattan",
    tagsEn: ["Tribeca", "Condo", "Loft"],
    priceDisplayEn: "$2.95M",
    mediaUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: aurumKey.id,
    ownerOfficeId: aurumOffice.id,
    informationOwnerOrganizationId: aurumKey.id,
    informationOwnerOfficeId: aurumOffice.id,
    createdByUserId: seedUser.id,
    marketId: newYorkMarket.id,
    assetClass: "apartment",
    assetSubtype: "designer rental",
    priceAmount: "7800.00",
    priceCurrency: "USD",
    title: "Flatiron Designer Rental",
    description: "Doorman building, fast commute profile, premium finishes, immediate availability.",
    addressDisplay: "Flatiron District, Manhattan",
    tags: ["Flatiron", "Rental", "High floor"],
    priceDisplay: "$7,800/mo",
    titleEn: "Flatiron Designer Rental",
    descriptionEn: "Doorman building, fast commute profile, premium finishes, immediate availability.",
    addressDisplayEn: "Flatiron District, Manhattan",
    tagsEn: ["Flatiron", "Rental", "High floor"],
    priceDisplayEn: "$7,800/mo",
    mediaUrl: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: aurumKey.id,
    ownerOfficeId: aurumOffice.id,
    informationOwnerOrganizationId: aurumKey.id,
    informationOwnerOfficeId: aurumOffice.id,
    createdByUserId: seedUser.id,
    marketId: newYorkMarket.id,
    assetClass: "house",
    assetSubtype: "townhouse",
    priceAmount: "4650000.00",
    priceCurrency: "USD",
    title: "Brooklyn Heights Townhouse",
    description: "Historic character, private outdoor space, family-led layout, rare block quality.",
    addressDisplay: "Brooklyn Heights",
    tags: ["Brooklyn Heights", "Townhouse", "Garden"],
    priceDisplay: "$4.65M",
    titleEn: "Brooklyn Heights Townhouse",
    descriptionEn: "Historic character, private outdoor space, family-led layout, rare block quality.",
    addressDisplayEn: "Brooklyn Heights",
    tagsEn: ["Brooklyn Heights", "Townhouse", "Garden"],
    priceDisplayEn: "$4.65M",
    mediaUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: huajing.id,
    ownerOfficeId: huajingOffice.id,
    informationOwnerOrganizationId: huajing.id,
    informationOwnerOfficeId: huajingOffice.id,
    createdByUserId: seedUser.id,
    marketId: shanghaiMarket.id,
    assetClass: "apartment",
    assetSubtype: "riverside residence",
    areaSqm: "189.00",
    priceCurrency: "USD",
    title: "Резиденция Riverside Cloud",
    description: "Квартира у набережной Хуанпу с private reception, видом на skyline и процессом документальной проверки.",
    addressDisplay: "Шанхай, Huangpu Riverside",
    tags: ["Шанхай", "Набережная", "Документы по запросу"],
    priceDisplay: "от ¥18,600,000",
    titleEn: "Riverside Cloud Residence",
    descriptionEn: "Huangpu riverside apartment with private reception, skyline views and document review workflow.",
    addressDisplayEn: "Shanghai, Huangpu Riverside",
    tagsEn: ["Shanghai", "Riverside", "Document review"],
    priceDisplayEn: "From ¥18,600,000",
    titleZh: "滨江云邸",
    descriptionZh: "黄浦滨江高端公寓，私享会客空间，城市天际线视野，交易资料需经专业复核。",
    addressDisplayZh: "上海 · 黄浦滨江",
    tagsZh: ["上海", "滨江", "资料复核"],
    priceDisplayZh: "约 ¥18,600,000 起",
    mediaUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: huajing.id,
    ownerOfficeId: huajingOffice.id,
    informationOwnerOrganizationId: huajing.id,
    informationOwnerOfficeId: huajingOffice.id,
    createdByUserId: seedUser.id,
    marketId: shenzhenMarket.id,
    assetClass: "apartment",
    assetSubtype: "bay area residence",
    areaSqm: "143.00",
    priceCurrency: "USD",
    title: "Bay Area Prologue",
    description: "Резиденция в Qianhai Bay Area для предпринимателей, семейной релокации и инвестиционного шортлиста.",
    addressDisplay: "Шэньчжэнь, Qianhai Bay Area",
    tags: ["Шэньчжэнь", "Qianhai", "Инвестиции"],
    priceDisplay: "от ¥12,800,000",
    titleEn: "Bay Area Prologue",
    descriptionEn: "Qianhai Bay Area residence for technology founders, family relocation and investment shortlist scenarios.",
    addressDisplayEn: "Shenzhen, Qianhai Bay Area",
    tagsEn: ["Shenzhen", "Qianhai", "Investment"],
    priceDisplayEn: "From ¥12,800,000",
    titleZh: "湾区序章",
    descriptionZh: "前海湾区核心住宅，适合科技创业者、家庭迁居与资产配置初筛。",
    addressDisplayZh: "深圳 · 前海湾区",
    tagsZh: ["深圳", "前海", "资产配置"],
    priceDisplayZh: "约 ¥12,800,000 起",
    mediaUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: huajing.id,
    ownerOfficeId: huajingOffice.id,
    informationOwnerOrganizationId: huajing.id,
    informationOwnerOfficeId: huajingOffice.id,
    createdByUserId: seedUser.id,
    marketId: hangzhouMarket.id,
    assetClass: "house",
    assetSubtype: "stacked villa",
    areaSqm: "168.00",
    priceCurrency: "USD",
    title: "Вилла Xixi Hidden",
    description: "Малоэтажный формат рядом с Xixi Wetland; private viewing и юридическая проверка перед сделкой обязательны.",
    addressDisplay: "Ханчжоу, Xixi Wetland",
    tags: ["Ханчжоу", "Вилла", "Low density"],
    priceDisplay: "от ¥9,600,000",
    titleEn: "Xixi Hidden Villa",
    descriptionEn: "Low-density villa-style home near Xixi Wetland with private viewing and legal review required.",
    addressDisplayEn: "Hangzhou, Xixi Wetland",
    tagsEn: ["Hangzhou", "Villa", "Low density"],
    priceDisplayEn: "From ¥9,600,000",
    titleZh: "西溪隐墅",
    descriptionZh: "西溪湿地旁低密叠墅，预约私享看房，成交前需完成法律与资料审阅。",
    addressDisplayZh: "杭州 · 西溪湿地",
    tagsZh: ["杭州", "叠墅", "低密"],
    priceDisplayZh: "约 ¥9,600,000 起",
    mediaUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: huajing.id,
    ownerOfficeId: huajingOffice.id,
    informationOwnerOrganizationId: huajing.id,
    informationOwnerOfficeId: huajingOffice.id,
    createdByUserId: seedUser.id,
    marketId: dubaiMarket.id,
    assetClass: "apartment",
    assetSubtype: "marina residence",
    areaSqm: "112.00",
    priceCurrency: "AED",
    title: "Gulf Skyline",
    description: "Dubai Marina apartment for cross-border investors; projected rental scenarios require broker review.",
    addressDisplay: "Dubai Marina",
    tags: ["Dubai", "Marina", "Investor shortlist"],
    priceDisplay: "от ¥5,900,000",
    titleEn: "Gulf Skyline",
    descriptionEn: "Dubai Marina apartment for cross-border investors; projected rental scenarios require broker review.",
    addressDisplayEn: "Dubai Marina",
    tagsEn: ["Dubai", "Marina", "Investor shortlist"],
    priceDisplayEn: "From ¥5,900,000",
    titleZh: "海湾天际",
    descriptionZh: "迪拜码头公寓，面向跨境投资客，租金测算需经经纪人与文件复核。",
    addressDisplayZh: "迪拜 · Dubai Marina",
    tagsZh: ["迪拜", "滨海", "投资初筛"],
    priceDisplayZh: "约 ¥5,900,000 起",
    mediaUrl: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: huajing.id,
    ownerOfficeId: huajingOffice.id,
    informationOwnerOrganizationId: huajing.id,
    informationOwnerOfficeId: huajingOffice.id,
    createdByUserId: seedUser.id,
    marketId: singaporeMarket.id,
    assetClass: "apartment",
    assetSubtype: "central residence",
    areaSqm: "128.00",
    priceCurrency: "USD",
    title: "Central Garden",
    description: "Central Area residence prepared for capital preservation briefs and family-office review.",
    addressDisplay: "Singapore, Central Area",
    tags: ["Singapore", "Central", "Capital preservation"],
    priceDisplay: "от ¥21,500,000",
    titleEn: "Central Garden",
    descriptionEn: "Central Area residence prepared for capital preservation briefs and family-office review.",
    addressDisplayEn: "Singapore, Central Area",
    tagsEn: ["Singapore", "Central", "Capital preservation"],
    priceDisplayEn: "From ¥21,500,000",
    titleZh: "中央花园",
    descriptionZh: "新加坡核心区住宅，适合稳健资产配置与家族办公室初步评估。",
    addressDisplayZh: "新加坡 · Central Area",
    tagsZh: ["新加坡", "核心区", "稳健配置"],
    priceDisplayZh: "约 ¥21,500,000 起",
    mediaUrl: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: huajing.id,
    ownerOfficeId: huajingOffice.id,
    informationOwnerOrganizationId: huajing.id,
    informationOwnerOfficeId: huajingOffice.id,
    createdByUserId: seedUser.id,
    marketId: tokyoMarket.id,
    assetClass: "apartment",
    assetSubtype: "aoyama residence",
    areaSqm: "96.00",
    priceCurrency: "USD",
    title: "Aoyama Residence",
    description: "Tokyo Aoyama compact luxury residence for long-horizon liquidity and lifestyle use cases.",
    addressDisplay: "Tokyo, Aoyama",
    tags: ["Tokyo", "Aoyama", "Long horizon"],
    priceDisplay: "от ¥14,200,000",
    titleEn: "Aoyama Residence",
    descriptionEn: "Tokyo Aoyama compact luxury residence for long-horizon liquidity and lifestyle use cases.",
    addressDisplayEn: "Tokyo, Aoyama",
    tagsEn: ["Tokyo", "Aoyama", "Long horizon"],
    priceDisplayEn: "From ¥14,200,000",
    titleZh: "青山公馆",
    descriptionZh: "东京青山精品住宅，适合长期流动性与生活方式双重需求。",
    addressDisplayZh: "东京 · 青山",
    tagsZh: ["东京", "青山", "长期持有"],
    priceDisplayZh: "约 ¥14,200,000 起",
    mediaUrl: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: kvartal.id,
    ownerOfficeId: kvartalOffice.id,
    informationOwnerOrganizationId: kvartal.id,
    informationOwnerOfficeId: kvartalOffice.id,
    createdByUserId: seedUser.id,
    marketId: batayskMarket.id,
    assetClass: "industrial_site",
    assetSubtype: "складской комплекс",
    priceCurrency: "RUB",
    title: "Складской комплекс в Батайске",
    description: "Складские помещения с высокими потолками, стеллажным хранением и подъездом к промышленной зоне.",
    addressDisplay: "Ростовская область, г. Батайск, Совхозная ул., район 6Б",
    tags: ["Склад", "Батайск", "Производство"],
    priceDisplay: "По запросу",
    titleEn: "Warehouse complex in Bataysk",
    descriptionEn: "Warehouse premises with high ceilings, rack storage and access to an industrial zone.",
    addressDisplayEn: "Rostov region, Bataysk, Sovkhoznaya Street, district 6B",
    tagsEn: ["Warehouse", "Bataysk", "Industrial"],
    priceDisplayEn: "On request",
    mediaUrl: "/images/objects/bataysk-warehouse.jpg",
  });

  await ensurePublishedObject({
    ownerOrganizationId: kvartal.id,
    ownerOfficeId: kvartalOffice.id,
    informationOwnerOrganizationId: kvartal.id,
    informationOwnerOfficeId: kvartalOffice.id,
    createdByUserId: seedUser.id,
    marketId: siriusMarket.id,
    assetClass: "development_project",
    assetSubtype: "гостиничный комплекс",
    landAreaSqm: "57868.00",
    priceCurrency: "RUB",
    cadastralNumber: "23:49:0402061:1072",
    title: "Гостиничный комплекс, Фигурная 45",
    description: "Земельный участок для размещения четырехзвездочных гостиничных комплексов на 700 и 420 номеров.",
    addressDisplay: "Краснодарский край, ф.т. Сириус, пгт. Сириус, ул. Фигурная, з/у 45",
    tags: ["Гостиница", "Сириус", "57 868 м²"],
    priceDisplay: "По запросу",
    titleEn: "Hotel complex, Figurnaya 45",
    descriptionEn: "Land plot for two four-star hotel complexes with 700 and 420 rooms.",
    addressDisplayEn: "Krasnodar region, Sirius, Figurnaya Street, plot 45",
    tagsEn: ["Hotel", "Sirius", "57,868 sqm"],
    priceDisplayEn: "On request",
    mediaUrl: "/images/objects/figurnaya-45-map.jpg",
  });

  await ensurePublishedObject({
    ownerOrganizationId: kvartal.id,
    ownerOfficeId: kvartalOffice.id,
    informationOwnerOrganizationId: kvartal.id,
    informationOwnerOfficeId: kvartalOffice.id,
    createdByUserId: seedUser.id,
    marketId: domodedovoMarket.id,
    assetClass: "land",
    assetSubtype: "земельный участок",
    landAreaSqm: "5615.00",
    priceCurrency: "RUB",
    cadastralNumber: "50:28:0060113:7403",
    title: "Земельный участок в Домодедово",
    description: "Участок рядом с трассой М-4 и сложившейся торговой инфраструктурой; разрешенное использование: магазины.",
    addressDisplay: "Московская область, г.о. Домодедово, мкр. Южный",
    tags: ["Земля", "Домодедово", "М-4"],
    priceDisplay: "По запросу",
    titleEn: "Land plot in Domodedovo",
    descriptionEn: "Land plot near the M-4 highway and established retail infrastructure; permitted use: shops.",
    addressDisplayEn: "Moscow region, Domodedovo urban district, Yuzhny microdistrict",
    tagsEn: ["Land", "Domodedovo", "M-4"],
    priceDisplayEn: "On request",
    mediaUrl: "/images/objects/domodedovo-land.jpg",
  });

  await ensurePublishedObject({
    ownerOrganizationId: kvartal.id,
    ownerOfficeId: kvartalOffice.id,
    informationOwnerOrganizationId: kvartal.id,
    informationOwnerOfficeId: kvartalOffice.id,
    createdByUserId: seedUser.id,
    marketId: kubinkaMarket.id,
    assetClass: "land",
    assetSubtype: "земельный участок",
    landAreaSqm: "2353.00",
    priceCurrency: "RUB",
    cadastralNumber: "50:20:0090427:2085",
    title: "Земельный участок в Кубинке",
    description: "Участок у активного торгового потока; разрешенное использование: стоянка транспортных средств.",
    addressDisplay: "Московская область, Кубинка, район строительного рынка",
    tags: ["Земля", "Кубинка", "Трафик"],
    priceDisplay: "По запросу",
    titleEn: "Land plot in Kubinka",
    descriptionEn: "Land plot next to active retail traffic; permitted use: vehicle parking.",
    addressDisplayEn: "Moscow region, Kubinka, construction market area",
    tagsEn: ["Land", "Kubinka", "Traffic"],
    priceDisplayEn: "On request",
    mediaUrl: "/images/objects/kubinka-land.jpg",
  });

  await ensurePublishedObject({
    ownerOrganizationId: kvartal.id,
    ownerOfficeId: kvartalOffice.id,
    informationOwnerOrganizationId: kvartal.id,
    informationOwnerOfficeId: kvartalOffice.id,
    createdByUserId: seedUser.id,
    marketId: istraMarket.id,
    assetClass: "land",
    assetSubtype: "земельный участок",
    priceCurrency: "RUB",
    title: "Участок, Истринский район, Холщевики",
    description: "Земельный участок в Истринском районе. Детальные параметры, документы и условия предоставляются по запросу.",
    addressDisplay: "Московская область, Истринский район, п. ст. Холщевики",
    tags: ["Земля", "Истра", "Холщевики"],
    priceDisplay: "По запросу",
    titleEn: "Land plot, Istra district, Kholshcheviki",
    descriptionEn: "Land plot in the Istra district. Detailed parameters, documents and terms are available on request.",
    addressDisplayEn: "Moscow region, Istra district, Kholshcheviki station settlement",
    tagsEn: ["Land", "Istra", "Kholshcheviki"],
    priceDisplayEn: "On request",
    mediaUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: apart4u.id,
    ownerOfficeId: apart4uOffice.id,
    informationOwnerOrganizationId: apart4u.id,
    informationOwnerOfficeId: apart4uOffice.id,
    createdByUserId: seedUser.id,
    marketId: tbilisiMarket.id,
    assetClass: "apartment",
    areaSqm: "118.00",
    priceCurrency: "USD",
    title: "Премиальная квартира в Тбилиси",
    description: "Опубликованный объект Apart4u, доступный в общей публичной витрине.",
    addressDisplay: "Тбилиси, центральный район",
    tags: ["Квартира", "Тбилиси", "Apart4u"],
    priceDisplay: "По запросу",
    titleEn: "Tbilisi premium apartment",
    descriptionEn: "Published Apart4u object available in the shared public inventory.",
    addressDisplayEn: "Tbilisi, central area",
    tagsEn: ["Apartment", "Tbilisi", "Apart4u"],
    priceDisplayEn: "On request",
    mediaUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: dubaiPartner.id,
    ownerOfficeId: dubaiOffice.id,
    informationOwnerOrganizationId: dubaiPartner.id,
    informationOwnerOfficeId: dubaiOffice.id,
    createdByUserId: seedUser.id,
    marketId: dubaiMarket.id,
    assetClass: "development_project",
    buildingAreaSqm: "2400.00",
    priceCurrency: "AED",
    title: "Девелоперский проект в Дубае",
    description: "Опубликованный проект дубайского партнера для трансграничных запросов покупателей.",
    addressDisplay: "Дубай, инвестиционная зона",
    tags: ["Дубай", "Девелопмент", "Инвестиции"],
    priceDisplay: "По запросу",
    titleEn: "Dubai development project",
    descriptionEn: "Published Dubai partner project prepared for cross-border buyer-side requests.",
    addressDisplayEn: "Dubai, investment zone",
    tagsEn: ["Dubai", "Development", "Investment"],
    priceDisplayEn: "On request",
    mediaUrl: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=82",
  });

  await ensurePublishedObject({
    ownerOrganizationId: yerevanPartner.id,
    ownerOfficeId: yerevanOffice.id,
    informationOwnerOrganizationId: yerevanPartner.id,
    informationOwnerOfficeId: yerevanOffice.id,
    createdByUserId: seedUser.id,
    marketId: yerevanMarket.id,
    assetClass: "land",
    landAreaSqm: "1800.00",
    priceCurrency: "USD",
    title: "Земельный участок в Ереване",
    description: "Опубликованный земельный объект ереванского партнера для общей публичной витрины.",
    addressDisplay: "Ереван, зона развития",
    tags: ["Ереван", "Земля", "Девелопмент"],
    priceDisplay: "По запросу",
    titleEn: "Yerevan land plot",
    descriptionEn: "Published Yerevan partner land object for the shared public inventory.",
    addressDisplayEn: "Yerevan, development area",
    tagsEn: ["Yerevan", "Land", "Development"],
    priceDisplayEn: "On request",
    mediaUrl: "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=1000&q=82",
  });

  await prisma.propertyObject.deleteMany({
    where: {
      status: "published",
      visibility: "public",
      media: { none: {} },
    },
  });

  const platformOwnerFirebaseUid = process.env.KVARTAL_PLATFORM_OWNER_FIREBASE_UID;
  const platformOwnerEmail = process.env.KVARTAL_PLATFORM_OWNER_EMAIL;

  if (platformOwnerFirebaseUid && platformOwnerEmail) {
    const owner = await prisma.appUser.upsert({
      where: { firebaseUid: platformOwnerFirebaseUid },
      update: { email: platformOwnerEmail, active: true },
      create: {
        firebaseUid: platformOwnerFirebaseUid,
        email: platformOwnerEmail,
        displayName: process.env.KVARTAL_PLATFORM_OWNER_DISPLAY_NAME ?? "KVARTAL Platform Owner",
        active: true,
      },
    });

    await prisma.platformRoleAssignment.upsert({
      where: { userId_role: { userId: owner.id, role: "platform_owner" } },
      update: { active: true },
      create: { userId: owner.id, role: "platform_owner", active: true },
    });
  }

  console.log(
    JSON.stringify({
      ok: true,
      markets: [
        moscowMarket.slug,
        batayskMarket.slug,
        siriusMarket.slug,
        domodedovoMarket.slug,
        kubinkaMarket.slug,
        istraMarket.slug,
        tbilisiMarket.slug,
        dubaiMarket.slug,
        yerevanMarket.slug,
        newYorkMarket.slug,
        shanghaiMarket.slug,
        shenzhenMarket.slug,
        hangzhouMarket.slug,
        singaporeMarket.slug,
        tokyoMarket.slug,
      ],
      organizations: [fixer.slug, kvartal.slug, apart4u.slug, dubaiPartner.slug, yerevanPartner.slug, aurumKey.slug, huajing.slug],
      offices: [
        platformOffice.slug,
        kvartalOffice.slug,
        apart4uOffice.slug,
        dubaiOffice.slug,
        yerevanOffice.slug,
        aurumOffice.slug,
        huajingOffice.slug,
      ],
      aurumOwnerSeeded: aurumOwner.email,
      platformOwnerSeeded: Boolean(platformOwnerFirebaseUid && platformOwnerEmail),
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

