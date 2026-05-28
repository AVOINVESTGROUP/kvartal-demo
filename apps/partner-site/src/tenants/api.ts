import { fetchBackendJson } from "../lib/server-api";
import type { PartnerInventoryItem, PartnerTenantKey } from "./types";

type PublicObjectsResponse = {
  objects: Array<{
    market: {
      city: string;
      country: string;
    };
    title: string;
    sellerSide: {
      organizationName: string;
    };
  }>;
};

export async function fetchPartnerInventory(tenant: PartnerTenantKey): Promise<PartnerInventoryItem[] | undefined> {
  const response = await fetchBackendJson<PublicObjectsResponse>(
    process.env.PUBLIC_API_BASE_URL,
    `/api/v1/public/objects?tenant=${encodeURIComponent(tenant)}&limit=12`,
  );

  if (!response?.objects.length) {
    return undefined;
  }

  return response.objects.map((object) => ({
    market: `${object.market.city}, ${object.market.country}`,
    title: object.title,
    sellerSidePartner: object.sellerSide.organizationName,
    buyerSidePartner: tenant === "apart4u" ? "Apart4u.co Tbilisi" : tenant === "dubai" ? "Dubai Partner" : "Yerevan Partner",
  }));
}
