import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  await prisma.office.upsert({
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

  await prisma.office.upsert({
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

  await prisma.office.upsert({
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
      markets: [moscowMarket.slug, tbilisiMarket.slug, dubaiMarket.slug],
      organizations: [fixer.slug, kvartal.slug, apart4u.slug],
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
