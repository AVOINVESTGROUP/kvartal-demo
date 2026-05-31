import { fetchBackendJson } from "@/lib/server-api";
import { ObjectsClient, type MarketSnapshot, type ObjectItem } from "./ObjectsClient";

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

type MarketInsightsResponse = MarketSnapshot;

function formatArea(object: PublicObjectsResponse["objects"][number]) {
  const area = object.areaSqm ?? object.landAreaSqm ?? object.buildingAreaSqm;

  return area ? `${Number(area).toLocaleString("en-US")} sqm` : "Area on request";
}

function toNumber(value: string | null) {
  return value ? Number(value) : undefined;
}

function assetClassLabel(assetClass: string, language: "ru" | "en") {
  const labels: Record<string, { ru: string; en: string }> = {
    land: { ru: "Земля", en: "Land" },
    apartment: { ru: "Квартира", en: "Apartment" },
    house: { ru: "Дом", en: "House" },
    office: { ru: "Офис", en: "Office" },
    industrial_site: { ru: "Промышленный объект", en: "Industrial site" },
    development_project: { ru: "Проект развития", en: "Development project" },
    investment_project: { ru: "Инвестиционный проект", en: "Investment project" },
  };

  return labels[assetClass]?.[language] ?? assetClass;
}

const fallbackObjects: ObjectItem[] = [
  {
    id: "fallback-moscow",
    title: "Moscow commercial property",
    type: "office",
    typeLabel: "Офис",
    typeLabelEn: "Office",
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

export async function getObjectItems() {
  const [ruResponse, enResponse] = await Promise.all([
    fetchBackendJson<PublicObjectsResponse>(process.env.PUBLIC_API_BASE_URL, "/api/v1/public/objects?tenant=kvartal&language=ru&limit=24"),
    fetchBackendJson<PublicObjectsResponse>(process.env.PUBLIC_API_BASE_URL, "/api/v1/public/objects?tenant=kvartal&language=en&limit=24"),
  ]);

  const enById = new Map(enResponse?.objects.map((object) => [object.id, object]));

  const objects =
    ruResponse?.objects.map((object) => {
      const enObject = enById.get(object.id);

      return {
      id: object.id,
      title: object.title,
      titleEn: enObject?.title ?? object.title,
      type: object.assetClass,
      typeLabel: assetClassLabel(object.assetClass, "ru"),
      typeLabelEn: assetClassLabel(object.assetClass, "en"),
      country: object.market.country,
      city: object.market.city,
      market: `${object.market.city}, ${object.market.country}`,
      area: toNumber(object.areaSqm ?? object.landAreaSqm ?? object.buildingAreaSqm),
      areaDisplay: formatArea(object),
      address: object.addressDisplay ?? `${object.market.city}, ${object.market.country}`,
      addressEn: enObject?.addressDisplay ?? object.addressDisplay ?? `${object.market.city}, ${object.market.country}`,
      owner: object.sellerSide.organizationName,
      description: object.description ?? "Published object from the shared public inventory.",
      descriptionEn: enObject?.description ?? object.description ?? "Published object from the shared public inventory.",
      imageUrl: object.media[0]?.url,
      tags: object.tags.length ? object.tags : [object.assetClass, object.market.city],
      tagsEn: enObject?.tags?.length ? enObject.tags : object.tags,
      };
    }) ?? fallbackObjects;

  return objects;
}

export async function getMarketSnapshot() {
  const response = await fetchBackendJson<MarketInsightsResponse>(
    process.env.PUBLIC_API_BASE_URL,
    "/api/v1/public/market-insights?tenant=kvartal&language=ru",
  );

  return response ?? null;
}

export async function Objects() {
  const [objects, marketSnapshot] = await Promise.all([getObjectItems(), getMarketSnapshot()]);

  return <ObjectsClient objects={objects} language="ru" marketSnapshot={marketSnapshot} />;
}
