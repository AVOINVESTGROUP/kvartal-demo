import { fetchBackendJson } from "../lib/server-api";
import type { PartnerInventoryByLanguage, PartnerInventoryItem, PartnerSiteLanguage, PartnerTenantKey } from "./types";

type PublicObjectsResponse = {
  objects: Array<{
    id: string;
    assetClass?: string;
    market: {
      city: string;
      country: string;
    };
    title: string;
    description?: string;
    addressDisplay?: string;
    priceDisplay?: string;
    areaSqm?: string | null;
    media?: Array<{
      url: string | null;
      kind?: string;
      public?: boolean;
      sortOrder?: number;
    }>;
    sellerSide: {
      organizationName: string;
    };
  }>;
};

export async function fetchPartnerInventory(tenant: PartnerTenantKey, language: PartnerSiteLanguage = "ru"): Promise<PartnerInventoryItem[] | undefined> {
  const response = await fetchBackendJson<PublicObjectsResponse>(
    process.env.PUBLIC_API_BASE_URL,
    `/api/v1/public/objects?tenant=${encodeURIComponent(tenant)}&language=${encodeURIComponent(language)}&limit=12`,
  );

  if (!response?.objects.length) {
    return undefined;
  }

  return response.objects.map((object) => {
    const coverMedia =
      object.media
        ?.filter((media) => media.url)
        .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))[0] ?? null;

    return {
      id: object.id,
      market: `${object.market.city}, ${object.market.country}`,
      city: object.market.city,
      country: object.market.country,
      title: object.title,
      description: object.description,
      addressDisplay: object.addressDisplay,
      assetClass: object.assetClass,
      priceDisplay: object.priceDisplay,
      areaSqm: object.areaSqm,
      mediaUrl: coverMedia?.url ?? null,
      sellerSidePartner: object.sellerSide.organizationName,
      buyerSidePartner:
        tenant === "apart4u"
          ? "Apart4u.co Tbilisi"
          : tenant === "dubai"
            ? "Dubai Partner"
            : tenant === "aurum"
              ? "Aurum Key Realty NYC"
              : "Yerevan Partner",
    };
  });
}

export async function fetchPartnerInventoryByLanguage(
  tenant: PartnerTenantKey,
  languages: PartnerSiteLanguage[] = ["en", "ru", "ka"],
): Promise<PartnerInventoryByLanguage> {
  const entries = await Promise.all(
    languages.map(async (language) => [language, (await fetchPartnerInventory(tenant, language)) ?? []] as const),
  );

  return Object.fromEntries(entries) as PartnerInventoryByLanguage;
}
