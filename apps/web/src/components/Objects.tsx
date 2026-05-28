import { fetchBackendJson } from "@/lib/server-api";
import { ObjectsClient, type ObjectItem } from "./ObjectsClient";

export const dynamic = "force-dynamic";

type PublicObjectsResponse = {
  objects: Array<{
    id: string;
    assetClass: string;
    market: {
      city: string;
      country: string;
    };
    title: string;
    description: string | null;
    addressDisplay: string | null;
    tags: string[];
    areaSqm: string | null;
    landAreaSqm: string | null;
    buildingAreaSqm: string | null;
    sellerSide: {
      organizationName: string;
    };
    media: Array<{
      url: string;
      kind: string;
    }>;
  }>;
};

function formatArea(object: PublicObjectsResponse["objects"][number]) {
  const area = object.areaSqm ?? object.landAreaSqm ?? object.buildingAreaSqm;

  return area ? `${Number(area).toLocaleString("en-US")} sqm` : "Area on request";
}

function toNumber(value: string | null) {
  return value ? Number(value) : undefined;
}

const fallbackObjects: ObjectItem[] = [
  {
    id: "fallback-moscow",
    title: "Moscow commercial property",
    type: "office",
    country: "RU",
    city: "Moscow",
    market: "Moscow, RU",
    area: 420,
    areaDisplay: "420 sqm",
    address: "Moscow, commercial district",
    owner: "KVARTAL Moscow",
    description: "Published seller-side object from KVARTAL Moscow for partner network display.",
    tags: ["commercial", "moscow", "seller-side"],
  },
];

export async function Objects() {
  const response = await fetchBackendJson<PublicObjectsResponse>(process.env.PUBLIC_API_BASE_URL, "/api/v1/public/objects?tenant=kvartal&limit=24");

  const objects =
    response?.objects.map((object) => ({
      id: object.id,
      title: object.title,
      type: object.assetClass,
      country: object.market.country,
      city: object.market.city,
      market: `${object.market.city}, ${object.market.country}`,
      area: toNumber(object.areaSqm ?? object.landAreaSqm ?? object.buildingAreaSqm),
      areaDisplay: formatArea(object),
      address: object.addressDisplay ?? `${object.market.city}, ${object.market.country}`,
      owner: object.sellerSide.organizationName,
      description: object.description ?? "Published object from the shared public inventory.",
      imageUrl: object.media[0]?.url,
      tags: object.tags.length ? object.tags : [object.assetClass, object.market.city],
    })) ?? fallbackObjects;

  return <ObjectsClient objects={objects} />;
}
