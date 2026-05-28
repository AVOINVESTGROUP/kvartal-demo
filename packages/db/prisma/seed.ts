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
  areaSqm?: string;
  landAreaSqm?: string;
  buildingAreaSqm?: string;
  priceAmount?: string;
  priceCurrency?: "RUB" | "USD" | "GEL" | "AMD" | "AED";
  title: string;
  description: string;
  addressDisplay: string;
  tags: string[];
  priceDisplay: string;
};

async function ensurePublishedObject(input: SeedObjectInput) {
  const existing = await prisma.propertyObject.findFirst({
    where: {
      ownerOfficeId: input.ownerOfficeId,
      localizations: {
        some: {
          language: "en",
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
    areaSqm: input.areaSqm,
    landAreaSqm: input.landAreaSqm,
    buildingAreaSqm: input.buildingAreaSqm,
    priceMode: "on_request" as const,
    priceAmount: input.priceAmount,
    priceCurrency: input.priceCurrency,
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
              language: "en",
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
    where: { propertyObjectId_language: { propertyObjectId: propertyObject.id, language: "en" } },
    update: {
      title: input.title,
      description: input.description,
      addressDisplay: input.addressDisplay,
      tags: input.tags,
      priceDisplay: input.priceDisplay,
    },
    create: {
      propertyObjectId: propertyObject.id,
      language: "en",
      title: input.title,
      description: input.description,
      addressDisplay: input.addressDisplay,
      tags: input.tags,
      priceDisplay: input.priceDisplay,
    },
  });

  return propertyObject;
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
    title: "Moscow commercial property",
    description: "Published seller-side object from KVARTAL Moscow for partner network display.",
    addressDisplay: "Moscow, commercial district",
    tags: ["commercial", "moscow", "seller-side"],
    priceDisplay: "Price on request",
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
    title: "Tbilisi premium apartment",
    description: "Published Apart4u object available in the shared public inventory.",
    addressDisplay: "Tbilisi, central area",
    tags: ["apartment", "tbilisi", "apart4u"],
    priceDisplay: "Price on request",
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
    title: "Dubai development project",
    description: "Published Dubai partner project prepared for cross-border buyer-side requests.",
    addressDisplay: "Dubai, investment zone",
    tags: ["dubai", "development", "investment"],
    priceDisplay: "Price on request",
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
    title: "Yerevan land plot",
    description: "Published Yerevan partner land object for the shared public inventory.",
    addressDisplay: "Yerevan, development area",
    tags: ["yerevan", "land", "development"],
    priceDisplay: "Price on request",
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
      markets: [moscowMarket.slug, tbilisiMarket.slug, dubaiMarket.slug, yerevanMarket.slug],
      organizations: [fixer.slug, kvartal.slug, apart4u.slug, dubaiPartner.slug, yerevanPartner.slug],
      offices: [platformOffice.slug, kvartalOffice.slug, apart4uOffice.slug, dubaiOffice.slug, yerevanOffice.slug],
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
