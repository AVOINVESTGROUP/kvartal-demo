import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Storage } from "@google-cloud/storage";

export const serviceName = "office-api";

export const ownedRoutes = [
  "/api/v1/public/objects",
  "/api/v1/public/media",
  "/api/v1/public/market-insights",
  "/api/v1/public/client-intents",
  "/api/v1/platform/market-insights/refresh",
  "/api/v1/admin/context",
  "/api/v1/admin/objects",
  "/api/v1/admin/media",
  "/api/v1/admin/access-settings",
  "/api/v1/admin/partner-objects",
  "/api/v1/admin/partner-object-visibility",
  "/api/v1/admin/members",
  "/api/v1/admin/property-intakes",
  "/api/v1/admin/client-intents",
  "/api/v1/admin/cobroker-requests",
  "/api/v1/admin/deal-rooms",
] as const;

const port = Number(process.env.PORT ?? 8080);
const prisma = new PrismaClient();
const storage = new Storage();
const storageBucketName = process.env.STORAGE_BUCKET ?? "kvartal-dev-property-assets";
const storageBucket = storage.bucket(storageBucketName);

const maxUploadBytesByKind = {
  image: 20 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  floor_plan: 20 * 1024 * 1024,
  map: 20 * 1024 * 1024,
  render: 20 * 1024 * 1024,
  virtual_tour: 500 * 1024 * 1024,
  drone: 500 * 1024 * 1024,
  other: 50 * 1024 * 1024,
} as const;

const allowedMediaKinds = new Set(Object.keys(maxUploadBytesByKind));

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendError(response: ServerResponse, status: number, code: string, message: string) {
  sendJson(response, status, { ok: false, error: { code, message } });
}

function sendRedirect(response: ServerResponse, location: string, cacheControl = "public, max-age=3600") {
  response.writeHead(302, {
    location,
    "cache-control": cacheControl,
  });
  response.end();
}

function streamStorageFile(
  response: ServerResponse,
  storagePath: string,
  metadata: { contentType?: string; size?: string | number; etag?: string; updated?: string },
  cacheControl: string,
) {
  const headers: Record<string, string> = {
    "cache-control": cacheControl,
  };

  if (metadata.contentType) {
    headers["content-type"] = metadata.contentType;
  }

  if (metadata.size !== undefined) {
    headers["content-length"] = String(metadata.size);
  }

  if (metadata.etag) {
    headers.etag = metadata.etag;
  }

  if (metadata.updated) {
    headers["last-modified"] = new Date(metadata.updated).toUTCString();
  }

  response.writeHead(200, headers);
  storageBucket.file(storagePath).createReadStream().on("error", () => response.destroy()).pipe(response);
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function decimalToString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalDecimal(value: unknown) {
  const text = optionalString(value);
  return text ? text.replace(",", ".") : undefined;
}

function optionalInteger(value: unknown) {
  const text = optionalString(value);
  return text ? Number.parseInt(text, 10) : undefined;
}

function booleanFromBody(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function tagsFromBody(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return optionalString(value)
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function hasAdminWriteAccess(request: IncomingMessage) {
  const expectedToken = process.env.ADMIN_WRITE_TOKEN;
  const suppliedToken = request.headers["x-kvartal-admin-write-token"];

  if (!expectedToken) {
    return false;
  }

  return typeof suppliedToken === "string" && suppliedToken.trim() === expectedToken.trim();
}

function hasAuthenticatedInvoker(request: IncomingMessage) {
  const authorization = request.headers.authorization;

  return typeof authorization === "string" && authorization.startsWith("Bearer ");
}

const tenantOrganizationSlugs = {
  kvartal: "kvartal-moscow",
  apart4u: "apart4u-tbilisi",
  dubai: "dubai-partner",
  yerevan: "yerevan-partner",
} as const;

const marketInsightMetric = "average_price_usd_sqm";
const marketInsightCategories = ["residential", "commercial"] as const;

type MarketInsightCategory = (typeof marketInsightCategories)[number];

function categoryLabel(category: MarketInsightCategory, language: string) {
  const labels = {
    residential: { ru: "Жилая", en: "Residential" },
    commercial: { ru: "Коммерческая", en: "Commercial" },
  } satisfies Record<MarketInsightCategory, Record<"ru" | "en", string>>;

  return labels[category][language === "en" ? "en" : "ru"];
}

function insightPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function stableMonthlyScore(input: string) {
  let score = 0;

  for (let index = 0; index < input.length; index += 1) {
    score = (score * 31 + input.charCodeAt(index)) >>> 0;
  }

  return score;
}

function organizationSlugForTenant(tenant: string) {
  return tenantOrganizationSlugs[tenant as keyof typeof tenantOrganizationSlugs] ?? tenant;
}

function normalizeMediaKind(value: unknown) {
  const kind = optionalString(value) ?? "image";
  return allowedMediaKinds.has(kind) ? kind : "other";
}

function extensionForFileName(fileName: string | undefined, mimeType: string) {
  const fromName = fileName?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

  if (fromName) {
    return fromName;
  }

  const byMimeType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/pdf": "pdf",
  };

  return byMimeType[mimeType] ?? "bin";
}

function allowedMimeForKind(kind: string, mimeType: string) {
  if (["image", "floor_plan", "map", "render"].includes(kind)) {
    return mimeType.startsWith("image/");
  }

  if (["video", "virtual_tour", "drone"].includes(kind)) {
    return mimeType.startsWith("video/");
  }

  return mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType === "application/pdf";
}

function maxUploadBytesForKind(kind: string) {
  return maxUploadBytesByKind[kind as keyof typeof maxUploadBytesByKind] ?? maxUploadBytesByKind.other;
}

type PublicObjectLocalizationRow = {
  language: string;
  title: string;
  description: string | null;
  addressDisplay: string;
  tags: string[];
  priceDisplay: string | null;
};

type PublicObjectMediaRow = {
  id: string;
  url: string | null;
  storagePath: string | null;
  kind: string;
  public: boolean;
  sortOrder: number;
  title: string | null;
  caption: string | null;
};

type PublicObjectRow = {
  id: string;
  assetClass: string;
  market: { slug: string; city: string; country: string };
  localizations: PublicObjectLocalizationRow[];
  areaSqm: unknown;
  landAreaSqm: unknown;
  buildingAreaSqm: unknown;
  priceAmount: unknown;
  priceCurrency: string | null;
  representationSide: string;
  requiresOwnerOfficeApprovalForLead: boolean;
  ownerOrganization: { slug: string; legalName: string };
  ownerOffice: { slug: string; legalName: string };
  informationOwnerOrganization: { slug: string; legalName: string };
  informationOwnerOffice: { slug: string; legalName: string };
  media: PublicObjectMediaRow[];
  publishedAt: Date | null;
};

type AdminOfficeRow = {
  id: string;
  slug: string;
  legalName: string;
  city: string;
  country: string;
  status: string;
  defaultMarket: { slug: string; city: string; country: string } | null;
  _count: { propertyObjects: number; clientIntents: number };
};

type AdminObjectRow = PublicObjectRow & {
  assetSubtype: string | null;
  status: string;
  visibility: string;
  canBeShownByOtherOffices: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AdminReferenceMarketRow = {
  id: string;
  slug: string;
  city: string;
  country: string;
  defaultCurrency: string;
  assetClasses: string[];
};

type AdminReferenceOfficeRow = {
  id: string;
  slug: string;
  legalName: string;
  city: string;
  country: string;
  defaultMarket: AdminReferenceMarketRow | null;
};

type AdminSiteConfigRow = {
  id: string;
  domain: string | null;
  subdomain: string | null;
  showPartnerObjects: boolean;
  active: boolean;
};

type AdminOrganizationMembershipRow = {
  id: string;
  roles: string[];
  active: boolean;
  user: { id: string; email: string; displayName: string | null; active: boolean };
};

function mediaUrlForContext(media: PublicObjectMediaRow, context: "public" | "admin") {
  if (media.storagePath) {
    return context === "admin" ? `/api/v1/admin/media/${encodeURIComponent(media.id)}` : `/api/v1/public/media/${encodeURIComponent(media.id)}`;
  }

  return media.url ?? "";
}

function serializeObject(object: PublicObjectRow, language = "ru", context: "public" | "admin" = "public") {
  const localization =
    object.localizations.find((item: PublicObjectLocalizationRow) => item.language === language) ??
    object.localizations.find((item: PublicObjectLocalizationRow) => item.language === "ru") ??
    object.localizations[0];

  return {
    id: object.id,
    assetClass: object.assetClass,
    market: {
      slug: object.market.slug,
      city: object.market.city,
      country: object.market.country,
    },
    title: localization?.title ?? object.assetClass,
    description: localization?.description ?? null,
    addressDisplay: localization?.addressDisplay ?? null,
    tags: localization?.tags ?? [],
    priceDisplay: localization?.priceDisplay ?? null,
    areaSqm: decimalToString(object.areaSqm),
    landAreaSqm: decimalToString(object.landAreaSqm),
    buildingAreaSqm: decimalToString(object.buildingAreaSqm),
    priceAmount: decimalToString(object.priceAmount),
    priceCurrency: object.priceCurrency,
    representationSide: object.representationSide,
    requiresOwnerOfficeApprovalForLead: object.requiresOwnerOfficeApprovalForLead,
    sellerSide: {
      organizationSlug: object.ownerOrganization.slug,
      organizationName: object.ownerOrganization.legalName,
      officeSlug: object.ownerOffice.slug,
      officeName: object.ownerOffice.legalName,
    },
    informationRightsHolder: {
      organizationSlug: object.informationOwnerOrganization.slug,
      organizationName: object.informationOwnerOrganization.legalName,
      officeSlug: object.informationOwnerOffice.slug,
      officeName: object.informationOwnerOffice.legalName,
    },
    media: object.media.map((media: PublicObjectMediaRow) => ({
      id: media.id,
      url: mediaUrlForContext(media, context),
      kind: media.kind,
      public: media.public,
      sortOrder: media.sortOrder,
      title: media.title,
      caption: media.caption,
    })),
    publishedAt: object.publishedAt?.toISOString() ?? null,
  };
}

type PublicMarketRow = {
  id: string;
  slug: string;
  city: string;
  country: string;
};

type MarketIndicatorRow = {
  marketId: string;
  segment: string;
  value: unknown;
  unit: string;
  currency: string | null;
  confidence: string;
  updatedAt: Date;
};

async function getPublicInventoryMarkets(tenant: string) {
  const tenantOrganizationSlug = organizationSlugForTenant(tenant);
  const tenantSiteConfig = await prisma.siteConfig.findFirst({
    where: { organization: { slug: tenantOrganizationSlug }, active: true },
    orderBy: { updatedAt: "desc" },
  });
  const hiddenOverrides = await prisma.$queryRaw<Array<{ propertyObjectId: string }>>`
    SELECT svo."propertyObjectId"
    FROM "SiteObjectVisibilityOverride" svo
    JOIN "Organization" o ON o.id = svo."organizationId"
    WHERE o.slug = ${tenantOrganizationSlug} AND svo.hidden = true
  `;
  const hiddenObjectIds = hiddenOverrides.map((item: { propertyObjectId: string }) => item.propertyObjectId);
  const effectiveOwnerSlug = tenantSiteConfig?.showPartnerObjects === false ? tenantOrganizationSlug : undefined;

  const objects = (await prisma.propertyObject.findMany({
    where: {
      status: "published",
      visibility: "public",
      canBeShownByOtherOffices: true,
      ...(hiddenObjectIds.length ? { id: { notIn: hiddenObjectIds } } : {}),
      ...(effectiveOwnerSlug ? { ownerOrganization: { slug: effectiveOwnerSlug } } : {}),
    },
    distinct: ["marketId"],
    select: {
      market: {
        select: {
          id: true,
          slug: true,
          city: true,
          country: true,
        },
      },
    },
  })) as Array<{ market: PublicMarketRow }>;

  return objects.map((item: { market: PublicMarketRow }) => item.market);
}

function serializeMarketIndicator(
  market: PublicMarketRow,
  category: MarketInsightCategory,
  indicator:
    | {
        value: unknown;
        unit: string;
        currency: string | null;
        confidence: string;
        updatedAt: Date;
      }
    | undefined,
  language: string,
) {
  return {
    category,
    label: categoryLabel(category, language),
    value: indicator?.value === undefined ? null : Number(indicator.value),
    currency: indicator?.currency ?? "USD",
    unit: indicator?.unit ?? "sqm",
    confidence: indicator?.confidence ?? "unsupported",
    updatedAt: indicator?.updatedAt?.toISOString() ?? null,
    city: market.city,
    country: market.country,
  };
}

function parseGeminiJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse(fenced ?? text);
}

async function generateMarketEstimateWithGemini(market: PublicMarketRow) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const prompt = [
    "Return only valid JSON, no markdown.",
    "Estimate current average real estate asking prices in USD per square meter.",
    "Categories: residential and commercial.",
    "Use broad market public knowledge only. If confidence is low, use null and unsupported.",
    "Do not promise returns or investment outcomes.",
    `Market: ${market.city}, ${market.country}.`,
    'Shape: {"residential":{"value":number|null,"confidence":"high|medium|low|unsupported"},"commercial":{"value":number|null,"confidence":"high|medium|low|unsupported"},"sources":["short source label"]}',
  ].join("\n");
  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  const headers: Record<string, string> = { "content-type": "application/json" };
  let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey ?? "")}`;

  if (!apiKey) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "kvartal-dev";
    const location = process.env.VERTEX_AI_LOCATION ?? "europe-west4";
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    const metadataTokenResponse = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" },
    });

    if (!metadataTokenResponse.ok) {
      throw new Error("Neither GEMINI_API_KEY nor Vertex AI metadata token is available.");
    }

    const tokenPayload = await metadataTokenResponse.json() as { access_token?: string };

    if (!tokenPayload.access_token) {
      throw new Error("Vertex AI metadata token response did not include access_token.");
    }

    headers.authorization = `Bearer ${tokenPayload.access_token}`;
    endpoint = `https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: requestBody,
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with ${response.status}.`);
  }

  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  return parseGeminiJson(text) as Record<MarketInsightCategory, { value?: number | null; confidence?: string }> & {
    sources?: string[];
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true, service: serviceName });
    return;
  }

  if (url.pathname === "/readyz") {
    try {
      const [result] = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
      const officeCount = await prisma.office.count();
      sendJson(response, 200, {
        ok: result?.ok === 1,
        service: serviceName,
        database: "ready",
        officeCount,
      });
    } catch (error) {
      sendJson(response, 503, {
        ok: false,
        service: serviceName,
        database: "not_ready",
        error: error instanceof Error ? error.message : "Unknown readiness error",
      });
    }
    return;
  }

  if (url.pathname === "/api/v1/public/market-insights" && request.method === "GET") {
    const tenant = url.searchParams.get("tenant") ?? "kvartal";
    const language = url.searchParams.get("language") ?? "ru";
    const period = url.searchParams.get("period") ?? insightPeriod();
    const marketsFromInventory = await getPublicInventoryMarkets(tenant);
    const moscowMarket = await prisma.market.findFirst({
      where: { city: "Moscow", country: "RU", active: true },
      select: { id: true, slug: true, city: true, country: true },
    });
    const marketsById = new Map<string, PublicMarketRow>();

    if (moscowMarket) {
      marketsById.set(moscowMarket.id, moscowMarket);
    }

    marketsFromInventory.forEach((market) => marketsById.set(market.id, market));

    const markets = Array.from(marketsById.values()) as PublicMarketRow[];
    const indicators = (await prisma.marketIndicator.findMany({
      where: {
        published: true,
        metric: marketInsightMetric,
        period,
        segment: { in: [...marketInsightCategories] },
        marketId: { in: markets.map((market) => market.id) },
      },
      orderBy: [{ updatedAt: "desc" }],
    })) as MarketIndicatorRow[];
    const indicatorByMarketAndCategory = new Map<string, MarketIndicatorRow>();

    indicators.forEach((indicator: MarketIndicatorRow) => {
      const key = `${indicator.marketId}:${indicator.segment}`;

      if (!indicatorByMarketAndCategory.has(key)) {
        indicatorByMarketAndCategory.set(key, indicator);
      }
    });

    const homeMarket =
      markets.find((market) => market.city === "Moscow" && market.country === "RU") ??
      markets[0];
    const updatedAt =
      indicators.reduce<Date | null>((latest: Date | null, indicator: MarketIndicatorRow) => {
        if (!latest || indicator.updatedAt > latest) {
          return indicator.updatedAt;
        }

        return latest;
      }, null)?.toISOString() ?? null;
    const otherMarkets = markets
      .filter((market) => market.id !== homeMarket?.id)
      .sort((a, b) => stableMonthlyScore(`${period}:${a.slug}`) - stableMonthlyScore(`${period}:${b.slug}`))
      .slice(0, 3);
    const serializeMarket = (market: PublicMarketRow) => ({
      id: market.id,
      slug: market.slug,
      city: market.city,
      country: market.country,
      indicators: Object.fromEntries(
        marketInsightCategories.map((category) => [
          category,
          serializeMarketIndicator(market, category, indicatorByMarketAndCategory.get(`${market.id}:${category}`), language),
        ]),
      ),
    });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      tenant,
      period,
      updatedAt,
      disclaimer:
        language === "en"
          ? "AI estimate, updated monthly. Broker verification required."
          : "Оценка AI, обновляется ежемесячно. Требуется проверка брокером.",
      homeMarket: homeMarket ? serializeMarket(homeMarket) : null,
      otherMarkets: otherMarkets.map(serializeMarket),
    });
    return;
  }

  if (url.pathname === "/api/v1/platform/market-insights/refresh" && request.method === "POST") {
    if (!hasAdminWriteAccess(request) && !hasAuthenticatedInvoker(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const period = insightPeriod();
    const markets = (await prisma.market.findMany({
      where: {
        active: true,
        propertyObjects: {
          some: {
            status: "published",
            visibility: "public",
            canBeShownByOtherOffices: true,
          },
        },
      },
      select: { id: true, slug: true, city: true, country: true },
      orderBy: [{ country: "asc" }, { city: "asc" }],
    })) as PublicMarketRow[];
    const writes: Array<{ market: string; category?: MarketInsightCategory; published: boolean; value?: number | null; confidence?: string; error?: string }> = [];

    for (const market of markets) {
      let aiResult: Awaited<ReturnType<typeof generateMarketEstimateWithGemini>>;

      try {
        aiResult = await generateMarketEstimateWithGemini(market);
      } catch (error) {
        writes.push({
          market: `${market.city}, ${market.country}`,
          published: false,
          error: error instanceof Error ? error.message : "Unknown AI refresh error",
        });
        continue;
      }

      const source = ["AI monthly market estimate", ...(Array.isArray(aiResult.sources) ? aiResult.sources.map((item: unknown) => String(item)).slice(0, 3) : [])].join("; ");

      for (const category of marketInsightCategories) {
        const estimate = aiResult[category];
        const value = typeof estimate?.value === "number" && Number.isFinite(estimate.value) ? estimate.value : null;
        const confidence = ["high", "medium", "low"].includes(String(estimate?.confidence)) ? String(estimate?.confidence) : "unsupported";
        const published = value !== null && confidence !== "unsupported";

        if (published) {
          await prisma.marketIndicator.create({
            data: {
              marketId: market.id,
              metric: marketInsightMetric,
              segment: category,
              value,
              unit: "sqm",
              currency: "USD",
              period,
              source,
              confidence: confidence as never,
              published: true,
            },
          });
        }

        writes.push({ market: `${market.city}, ${market.country}`, category, published, value, confidence });
      }
    }

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      period,
      markets: markets.length,
      writes,
    });
    return;
  }

  const publicMediaMatch = url.pathname.match(/^\/api\/v1\/public\/media\/([^/]+)$/);

  if (publicMediaMatch && request.method === "GET") {
    const mediaId = decodeURIComponent(publicMediaMatch[1]);
    const media = await prisma.propertyMedia.findUnique({
      where: { id: mediaId },
      include: { propertyObject: true },
    });

    if (!media || !media.public || media.propertyObject.status !== "published" || media.propertyObject.visibility !== "public") {
      sendError(response, 404, "media_not_found", "Public media was not found.");
      return;
    }

    if (!media.storagePath && media.url) {
      sendRedirect(response, media.url);
      return;
    }

    if (!media.storagePath) {
      sendError(response, 404, "media_not_found", "Public media has no storage path.");
      return;
    }

    const [metadata] = await storageBucket.file(media.storagePath).getMetadata();
    streamStorageFile(response, media.storagePath, metadata, "public, max-age=86400, stale-while-revalidate=604800");
    return;
  }

  const adminMediaMatch = url.pathname.match(/^\/api\/v1\/admin\/media\/([^/]+)$/);

  if (adminMediaMatch && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      action?: "set_cover";
      public?: unknown;
    };

    const mediaId = decodeURIComponent(adminMediaMatch[1]);
    const body = await readJsonBody<Body>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const media = await prisma.propertyMedia.findFirst({
      where: { id: mediaId, propertyObject: { ownerOrganization: { slug: organizationSlug } } },
      include: { propertyObject: true },
    });

    if (!media) {
      sendError(response, 404, "media_not_found", "Admin media was not found.");
      return;
    }

    if (body.action !== "set_cover") {
      sendError(response, 400, "unsupported_media_action", "Only set_cover is supported.");
      return;
    }

    await prisma.$transaction([
      prisma.propertyMedia.updateMany({
        where: { propertyObjectId: media.propertyObjectId, id: { not: media.id } },
        data: { sortOrder: 100 },
      }),
      prisma.propertyMedia.update({
        where: { id: media.id },
        data: {
          sortOrder: 0,
          public: body.public === undefined ? media.public : booleanFromBody(body.public),
        },
      }),
    ]);

    sendJson(response, 200, {
      ok: true,
      media: {
        id: media.id,
        propertyObjectId: media.propertyObjectId,
        sortOrder: 0,
        public: body.public === undefined ? media.public : booleanFromBody(body.public),
      },
    });
    return;
  }

  if (adminMediaMatch && request.method === "DELETE") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const mediaId = decodeURIComponent(adminMediaMatch[1]);
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const media = await prisma.propertyMedia.findFirst({
      where: { id: mediaId, propertyObject: { ownerOrganization: { slug: organizationSlug } } },
    });

    if (!media) {
      sendError(response, 404, "media_not_found", "Admin media was not found.");
      return;
    }

    if (media.storagePath) {
      await storageBucket.file(media.storagePath).delete({ ignoreNotFound: true });
    }

    await prisma.propertyMedia.delete({ where: { id: media.id } });

    if (media.sortOrder === 0) {
      const nextMedia = await prisma.propertyMedia.findFirst({
        where: { propertyObjectId: media.propertyObjectId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      if (nextMedia) {
        await prisma.propertyMedia.update({
          where: { id: nextMedia.id },
          data: { sortOrder: 0 },
        });
      }
    }

    sendJson(response, 200, {
      ok: true,
      deletedMediaId: media.id,
      propertyObjectId: media.propertyObjectId,
    });
    return;
  }

  if (adminMediaMatch && request.method === "GET") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_media_forbidden", "Admin media token is missing or invalid.");
      return;
    }

    const mediaId = decodeURIComponent(adminMediaMatch[1]);
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const media = await prisma.propertyMedia.findFirst({
      where: { id: mediaId, propertyObject: { ownerOrganization: { slug: organizationSlug } } },
    });

    if (!media) {
      sendError(response, 404, "media_not_found", "Admin media was not found.");
      return;
    }

    if (!media.storagePath && media.url) {
      sendRedirect(response, media.url, "private, max-age=300");
      return;
    }

    if (!media.storagePath) {
      sendError(response, 404, "media_not_found", "Admin media has no storage path.");
      return;
    }

    const [metadata] = await storageBucket.file(media.storagePath).getMetadata();
    streamStorageFile(response, media.storagePath, metadata, "private, max-age=300");
    return;
  }

  if (url.pathname === "/api/v1/public/objects" && request.method === "GET") {
    const tenant = url.searchParams.get("tenant") ?? "apart4u";
    const ownerSlug = url.searchParams.get("ownerOrganizationSlug");
    const language = url.searchParams.get("language") ?? "ru";
    const take = Math.min(Number(url.searchParams.get("limit") ?? 12), 50);
    const tenantOrganizationSlug = organizationSlugForTenant(tenant);

    const tenantSiteConfig = await prisma.siteConfig.findFirst({
      where: { organization: { slug: tenantOrganizationSlug }, active: true },
      orderBy: { updatedAt: "desc" },
    });
    const hiddenOverrides = await prisma.$queryRaw<Array<{ propertyObjectId: string }>>`
      SELECT svo."propertyObjectId"
      FROM "SiteObjectVisibilityOverride" svo
      JOIN "Organization" o ON o.id = svo."organizationId"
      WHERE o.slug = ${tenantOrganizationSlug} AND svo.hidden = true
    `;
    const hiddenObjectIds = hiddenOverrides.map((item: { propertyObjectId: string }) => item.propertyObjectId);
    const effectiveOwnerSlug = ownerSlug ?? (tenantSiteConfig?.showPartnerObjects === false ? tenantOrganizationSlug : undefined);

    const objects = await prisma.propertyObject.findMany({
      where: {
        status: "published",
        visibility: "public",
        canBeShownByOtherOffices: true,
        ...(hiddenObjectIds.length ? { id: { notIn: hiddenObjectIds } } : {}),
        ...(effectiveOwnerSlug ? { ownerOrganization: { slug: effectiveOwnerSlug } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take,
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: {
          where: { public: true },
          orderBy: { sortOrder: "asc" },
          take: 3,
        },
      },
    });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      tenant,
      tenantOrganizationSlug,
      showPartnerObjects: tenantSiteConfig?.showPartnerObjects ?? true,
      visibilityRule: effectiveOwnerSlug
        ? "status=published AND visibility=public AND canBeShownByOtherOffices=true AND ownerOrganization=tenant"
        : "status=published AND visibility=public AND canBeShownByOtherOffices=true",
      objects: objects.map((object: PublicObjectRow) => serializeObject(object, language)),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/context" && request.method === "GET") {
    const requestedTenant = url.searchParams.get("tenant") ?? "apart4u";
    const organizationSlug =
      url.searchParams.get("organizationSlug") ??
      tenantOrganizationSlugs[requestedTenant as keyof typeof tenantOrganizationSlugs] ??
      "apart4u-tbilisi";

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: {
          include: {
            defaultMarket: true,
            _count: {
              select: {
                propertyObjects: true,
                clientIntents: true,
              },
            },
          },
          orderBy: { legalName: "asc" },
        },
        siteConfigs: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
        memberships: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            propertyObjects: true,
            informationOwnedObjects: true,
            clientIntents: true,
          },
        },
      },
    });

    if (!organization) {
      sendJson(response, 404, {
        ok: false,
        error: {
          code: "organization_not_found",
          message: `Organization '${organizationSlug}' was not found.`,
        },
      });
      return;
    }

    const sharedPublicInventoryCount = await prisma.propertyObject.count({
      where: { status: "published", visibility: "public", canBeShownByOtherOffices: true },
    });
    const siteConfig = (organization.siteConfigs[0] as AdminSiteConfigRow | undefined) ?? null;
    const memberships = organization.memberships as AdminOrganizationMembershipRow[];

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      tenant: requestedTenant,
      organization: {
        id: organization.id,
        slug: organization.slug,
        legalName: organization.legalName,
        countryOfRegistration: organization.countryOfRegistration,
        operatingCountryCodes: organization.operatingCountryCodes,
        status: organization.status,
        defaultLanguage: organization.defaultLanguage,
        defaultCurrency: organization.defaultCurrency,
        siteConfig: {
          domain: siteConfig?.domain ?? null,
          subdomain: siteConfig?.subdomain ?? null,
          showPartnerObjects: siteConfig?.showPartnerObjects ?? true,
          active: siteConfig?.active ?? true,
        },
        counts: {
          ownedObjects: organization._count.propertyObjects,
          informationOwnedObjects: organization._count.informationOwnedObjects,
          clientIntents: organization._count.clientIntents,
          sharedPublicInventory: sharedPublicInventoryCount,
        },
        offices: organization.offices.map((office: AdminOfficeRow) => ({
          id: office.id,
          slug: office.slug,
          legalName: office.legalName,
          city: office.city,
          country: office.country,
          status: office.status,
          defaultMarket: office.defaultMarket
            ? {
                slug: office.defaultMarket.slug,
                city: office.defaultMarket.city,
                country: office.defaultMarket.country,
              }
            : null,
          counts: {
            propertyObjects: office._count.propertyObjects,
            clientIntents: office._count.clientIntents,
          },
        })),
        members: memberships.map((membership) => ({
          id: membership.id,
          email: membership.user.email,
          displayName: membership.user.displayName,
          roles: membership.roles,
          active: membership.active && membership.user.active,
        })),
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/objects" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const language = url.searchParams.get("language") ?? "ru";
    const take = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

    const objects = await prisma.propertyObject.findMany({
      where: {
        ownerOrganization: { slug: organizationSlug },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take,
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: {
          orderBy: { sortOrder: "asc" },
          take: 5,
        },
      },
    });

    sendJson(response, 200, {
      ok: true,
      service: serviceName,
      organizationSlug,
      scopeRule: "ownerOrganization.slug = requested organization",
      objects: objects.map((object: AdminObjectRow) => ({
        ...serializeObject(object, language, "admin"),
        titleEn: object.localizations.find((item) => item.language === "en")?.title ?? null,
        descriptionEn: object.localizations.find((item) => item.language === "en")?.description ?? null,
        addressDisplayEn: object.localizations.find((item) => item.language === "en")?.addressDisplay ?? null,
        tagsEn: object.localizations.find((item) => item.language === "en")?.tags ?? [],
        priceDisplayEn: object.localizations.find((item) => item.language === "en")?.priceDisplay ?? null,
        assetSubtype: object.assetSubtype,
        status: object.status,
        visibility: object.visibility,
        canBeShownByOtherOffices: object.canBeShownByOtherOffices,
        mediaCount: object.media.length,
        createdAt: object.createdAt.toISOString(),
        updatedAt: object.updatedAt.toISOString(),
      })),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/reference" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: {
          include: { defaultMarket: true },
          orderBy: { legalName: "asc" },
        },
      },
    });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const markets = await prisma.market.findMany({
      where: { active: true },
      orderBy: [{ country: "asc" }, { city: "asc" }],
    });
    const offices = organization.offices as AdminReferenceOfficeRow[];
    const referenceMarkets = markets as AdminReferenceMarketRow[];

    sendJson(response, 200, {
      ok: true,
      organization: {
        id: organization.id,
        slug: organization.slug,
        legalName: organization.legalName,
      },
      offices: offices.map((office: AdminReferenceOfficeRow) => ({
        id: office.id,
        slug: office.slug,
        legalName: office.legalName,
        city: office.city,
        country: office.country,
        defaultMarketSlug: office.defaultMarket?.slug ?? null,
      })),
      markets: referenceMarkets.map((market: AdminReferenceMarketRow) => ({
        id: market.id,
        slug: market.slug,
        city: market.city,
        country: market.country,
        defaultCurrency: market.defaultCurrency,
        assetClasses: market.assetClasses,
      })),
      assetClasses: [
        "land",
        "apartment",
        "house",
        "warehouse",
        "industrial_site",
        "factory",
        "hotel",
        "office",
        "retail",
        "mixed_use",
        "development_project",
        "investment_project",
        "other",
      ],
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/access-settings" && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type AccessSettingsBody = {
      organizationSlug?: string;
      showPartnerObjects?: unknown;
    };

    const body = await readJsonBody<AccessSettingsBody>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: {
          include: { defaultMarket: true },
          orderBy: { legalName: "asc" },
        },
      },
    });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const offices = organization.offices as AdminReferenceOfficeRow[];
    const office = offices[0];

    if (!office) {
      sendError(response, 400, "office_not_found", `Organization '${organizationSlug}' has no office.`);
      return;
    }

    const existingSiteConfig = await prisma.siteConfig.findFirst({
      where: { organizationId: organization.id },
      orderBy: { updatedAt: "desc" },
    });
    const showPartnerObjects = booleanFromBody(body.showPartnerObjects);
    const siteConfig = existingSiteConfig
      ? await prisma.siteConfig.update({
          where: { id: existingSiteConfig.id },
          data: { showPartnerObjects, active: true },
        })
      : await prisma.siteConfig.create({
          data: {
            organizationId: organization.id,
            officeId: office.id,
            defaultLanguage: organization.defaultLanguage,
            supportedLanguages: organization.supportedLanguages,
            defaultCurrency: organization.defaultCurrency,
            supportedCurrencies: organization.supportedCurrencies,
            primaryMarketIds: office.defaultMarket ? [office.defaultMarket.id] : [],
            showPartnerObjects,
            active: true,
          },
        });

    sendJson(response, 200, {
      ok: true,
      organizationSlug,
      siteConfig: {
        domain: siteConfig.domain,
        subdomain: siteConfig.subdomain,
        showPartnerObjects: siteConfig.showPartnerObjects,
        active: siteConfig.active,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/partner-objects" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const language = url.searchParams.get("language") ?? "ru";
    const take = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);
    const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const objects = await prisma.propertyObject.findMany({
      where: {
        status: "published",
        visibility: "public",
        canBeShownByOtherOffices: true,
        ownerOrganization: { slug: { not: organizationSlug } },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take,
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: {
          where: { public: true },
          orderBy: { sortOrder: "asc" },
          take: 3,
        },
      },
    });
    const visibilityOverrides = await prisma.$queryRaw<Array<{ propertyObjectId: string; hidden: boolean }>>`
      SELECT "propertyObjectId", hidden
      FROM "SiteObjectVisibilityOverride"
      WHERE "organizationId" = ${organization.id}
    `;
    const hiddenByObjectId = new Map(
      visibilityOverrides.map((override: { propertyObjectId: string; hidden: boolean }) => [override.propertyObjectId, override.hidden]),
    );

    sendJson(response, 200, {
      ok: true,
      organizationSlug,
      objects: objects.map((object: AdminObjectRow) => ({
        ...serializeObject(object, language, "admin"),
        status: object.status,
        visibility: object.visibility,
        canBeShownByOtherOffices: object.canBeShownByOtherOffices,
        hiddenOnThisSite: hiddenByObjectId.get(object.id) === true,
        mediaCount: object.media.length,
        updatedAt: object.updatedAt.toISOString(),
      })),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/partner-object-visibility" && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      propertyObjectId?: string;
      hidden?: unknown;
    };

    const body = await readJsonBody<Body>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const propertyObjectId = optionalString(body.propertyObjectId);
    const hidden = booleanFromBody(body.hidden);

    if (!propertyObjectId) {
      sendError(response, 400, "property_object_required", "propertyObjectId is required.");
      return;
    }

    const [organization, propertyObject] = await Promise.all([
      prisma.organization.findUnique({ where: { slug: organizationSlug } }),
      prisma.propertyObject.findUnique({
        where: { id: propertyObjectId },
        include: { ownerOrganization: true },
      }),
    ]);

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    if (!propertyObject) {
      sendError(response, 404, "property_object_not_found", `Property object '${propertyObjectId}' was not found.`);
      return;
    }

    if (propertyObject.ownerOrganization.slug === organizationSlug) {
      sendError(response, 400, "own_object_not_allowed", "Own organization objects are controlled through publication settings, not partner visibility overrides.");
      return;
    }

    await prisma.$executeRaw`
      INSERT INTO "SiteObjectVisibilityOverride" ("id", "organizationId", "propertyObjectId", "hidden", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${organization.id}, ${propertyObjectId}, ${hidden}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("organizationId", "propertyObjectId")
      DO UPDATE SET "hidden" = EXCLUDED."hidden", "updatedAt" = CURRENT_TIMESTAMP
    `;

    sendJson(response, 200, {
      ok: true,
      organizationSlug,
      propertyObjectId,
      hidden,
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/members" && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type CreateMemberBody = {
      organizationSlug?: string;
      email?: string;
      displayName?: string;
      organizationRole?: "organization_owner" | "organization_admin";
      officeSlug?: string;
      officeRole?: "office_owner" | "office_admin" | "broker" | "office_analyst" | "office_viewer";
    };

    const body = await readJsonBody<CreateMemberBody>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const email = optionalString(body.email)?.toLowerCase();

    if (!email) {
      sendError(response, 400, "email_required", "User email is required.");
      return;
    }

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: true,
      },
    });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const user = await prisma.appUser.upsert({
      where: { email },
      update: {
        displayName: optionalString(body.displayName),
        active: true,
      },
      create: {
        firebaseUid: `pending:${email}`,
        email,
        displayName: optionalString(body.displayName),
        active: true,
      },
    });

    const organizationRole = (optionalString(body.organizationRole) ?? "organization_admin") as never;
    const membership = await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: {
        roles: [organizationRole],
        active: true,
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roles: [organizationRole],
        active: true,
      },
    });

    const office = (organization.offices as Array<{ id: string; slug: string }>).find(
      (item: { id: string; slug: string }) => item.slug === optionalString(body.officeSlug),
    );
    const officeRole = optionalString(body.officeRole);

    if (office && officeRole) {
      await prisma.officeMembership.upsert({
        where: { officeId_userId: { officeId: office.id, userId: user.id } },
        update: {
          roles: [officeRole as never],
          active: true,
        },
        create: {
          organizationId: organization.id,
          officeId: office.id,
          userId: user.id,
          roles: [officeRole as never],
          active: true,
        },
      });
    }

    sendJson(response, 201, {
      ok: true,
      member: {
        id: membership.id,
        email: user.email,
        displayName: user.displayName,
        roles: membership.roles,
        active: membership.active && user.active,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/objects" && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type CreateObjectBody = {
      organizationSlug?: string;
      officeSlug?: string;
      marketSlug?: string;
      assetClass?: string;
      assetSubtype?: string;
      status?: string;
      visibility?: string;
      canBeShownByOtherOffices?: unknown;
      title?: string;
      titleEn?: string;
      description?: string;
      descriptionEn?: string;
      addressDisplay?: string;
      addressDisplayEn?: string;
      tags?: unknown;
      tagsEn?: unknown;
      areaSqm?: string;
      landAreaSqm?: string;
      buildingAreaSqm?: string;
      rentableAreaSqm?: string;
      floorNumber?: string;
      floorsTotal?: string;
      roomsCount?: string;
      bedroomsCount?: string;
      bathroomsCount?: string;
      cadastralNumber?: string;
      priceDisplay?: string;
      priceDisplayEn?: string;
      priceAmount?: string;
      priceCurrency?: string;
      mediaUrl?: string;
    };

    const body = await readJsonBody<CreateObjectBody>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const title = optionalString(body.title);
    const addressDisplay = optionalString(body.addressDisplay);

    if (!title || !addressDisplay) {
      sendError(response, 400, "required_fields_missing", "Title and addressDisplay are required.");
      return;
    }

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      include: {
        offices: {
          include: { defaultMarket: true },
          orderBy: { legalName: "asc" },
        },
      },
    });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const offices = organization.offices as AdminReferenceOfficeRow[];
    const office =
      offices.find((item: AdminReferenceOfficeRow) => item.slug === optionalString(body.officeSlug)) ??
      offices[0];

    if (!office) {
      sendError(response, 400, "office_not_found", `Organization '${organizationSlug}' has no office.`);
      return;
    }

    const market = optionalString(body.marketSlug)
      ? await prisma.market.findUnique({ where: { slug: optionalString(body.marketSlug) } })
      : office.defaultMarket;

    if (!market) {
      sendError(response, 400, "market_not_found", "Market is required.");
      return;
    }

    const createdByUser = await prisma.appUser.upsert({
      where: { firebaseUid: "admin-console-system-user" },
      update: { email: "admin-console@fixer.guru", active: true },
      create: {
        firebaseUid: "admin-console-system-user",
        email: "admin-console@fixer.guru",
        displayName: "KVARTAL Admin Console",
        active: true,
      },
    });

    const status = optionalString(body.status) === "published" ? "published" : "draft";
    const visibility = optionalString(body.visibility) === "public" ? "public" : optionalString(body.visibility) === "office_network" ? "office_network" : "private";
    const mediaUrl = optionalString(body.mediaUrl);

    const propertyObject = await prisma.propertyObject.create({
      data: {
        ownerOrganizationId: organization.id,
        ownerOfficeId: office.id,
        informationOwnerOrganizationId: organization.id,
        informationOwnerOfficeId: office.id,
        createdByUserId: createdByUser.id,
        marketId: market.id,
        status,
        visibility,
        assetClass: (optionalString(body.assetClass) ?? "land") as never,
        assetSubtype: optionalString(body.assetSubtype),
        areaSqm: optionalDecimal(body.areaSqm),
        landAreaSqm: optionalDecimal(body.landAreaSqm),
        buildingAreaSqm: optionalDecimal(body.buildingAreaSqm),
        rentableAreaSqm: optionalDecimal(body.rentableAreaSqm),
        floorNumber: optionalInteger(body.floorNumber),
        floorsTotal: optionalInteger(body.floorsTotal),
        roomsCount: optionalInteger(body.roomsCount),
        bedroomsCount: optionalInteger(body.bedroomsCount),
        bathroomsCount: optionalInteger(body.bathroomsCount),
        cadastralNumber: optionalString(body.cadastralNumber),
        priceMode: optionalDecimal(body.priceAmount) ? "fixed" : "on_request",
        priceAmount: optionalDecimal(body.priceAmount),
        priceCurrency: optionalString(body.priceCurrency) as never,
        representationSide: "seller",
        exclusivity: "unknown",
        canBeShownByOtherOffices: booleanFromBody(body.canBeShownByOtherOffices),
        requiresOwnerOfficeApprovalForLead: true,
        publishedAt: status === "published" ? new Date() : null,
        localizations: {
          create: [
            {
              language: "ru",
              title,
              description: optionalString(body.description),
              addressDisplay,
              tags: tagsFromBody(body.tags),
              priceDisplay: optionalString(body.priceDisplay),
            },
            {
              language: "en",
              title: optionalString(body.titleEn) ?? title,
              description: optionalString(body.descriptionEn) ?? optionalString(body.description),
              addressDisplay: optionalString(body.addressDisplayEn) ?? addressDisplay,
              tags: tagsFromBody(body.tagsEn).length ? tagsFromBody(body.tagsEn) : tagsFromBody(body.tags),
              priceDisplay: optionalString(body.priceDisplayEn) ?? optionalString(body.priceDisplay),
            },
          ],
        },
        ...(mediaUrl
          ? {
              media: {
                create: {
                  ownerOrganizationId: organization.id,
                  ownerOfficeId: office.id,
                  url: mediaUrl,
                  kind: "image",
                  public: true,
                  sortOrder: 10,
                },
              },
            }
          : {}),
      },
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: true,
      },
    });

    sendJson(response, 201, { ok: true, object: serializeObject(propertyObject as AdminObjectRow, "ru", "admin") });
    return;
  }

  const mediaUploadUrlMatch = url.pathname.match(/^\/api\/v1\/admin\/objects\/([^/]+)\/media\/upload-url$/);

  if (mediaUploadUrlMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      originalFileName?: string;
      mimeType?: string;
      kind?: string;
      public?: unknown;
      title?: string;
      caption?: string;
      uploadedByEmail?: string;
      makeCover?: unknown;
    };

    const objectId = decodeURIComponent(mediaUploadUrlMatch[1]);
    const body = await readJsonBody<Body>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const originalFileName = optionalString(body.originalFileName) ?? "upload";
    const mimeType = optionalString(body.mimeType) ?? "application/octet-stream";
    const kind = normalizeMediaKind(body.kind);

    if (!allowedMimeForKind(kind, mimeType)) {
      sendError(response, 400, "unsupported_media_type", `MIME type '${mimeType}' is not allowed for kind '${kind}'.`);
      return;
    }

    const propertyObject = await prisma.propertyObject.findFirst({
      where: { id: objectId, ownerOrganization: { slug: organizationSlug } },
      include: { ownerOrganization: true, ownerOffice: true },
    });

    if (!propertyObject) {
      sendError(response, 404, "object_not_found", `Object '${objectId}' was not found for '${organizationSlug}'.`);
      return;
    }

    const mediaId = randomUUID();
    const extension = extensionForFileName(originalFileName, mimeType);
    const publicSegment = booleanFromBody(body.public) ? "public" : "private";
    const storagePath = [
      "organizations",
      propertyObject.ownerOrganizationId,
      "offices",
      propertyObject.ownerOfficeId,
      "objects",
      propertyObject.id,
      publicSegment,
      "media",
      mediaId,
      `original.${extension}`,
    ].join("/");
    const maxBytes = maxUploadBytesForKind(kind);
    const [policy] = await storageBucket.file(storagePath).generateSignedPostPolicyV4({
      expires: Date.now() + 15 * 60 * 1000,
      conditions: [
        ["eq", "$Content-Type", mimeType],
        ["content-length-range", 0, maxBytes],
      ],
      fields: {
        "Content-Type": mimeType,
      },
    });

    sendJson(response, 200, {
      ok: true,
      upload: {
        mediaId,
        storagePath,
        url: policy.url,
        fields: policy.fields,
        method: "POST",
        maxBytes,
      },
    });
    return;
  }

  const mediaConfirmMatch = url.pathname.match(/^\/api\/v1\/admin\/objects\/([^/]+)\/media\/confirm$/);

  if (mediaConfirmMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      mediaId?: string;
      storagePath?: string;
      originalFileName?: string;
      kind?: string;
      public?: unknown;
      title?: string;
      caption?: string;
      uploadedByEmail?: string;
      makeCover?: unknown;
    };

    const objectId = decodeURIComponent(mediaConfirmMatch[1]);
    const body = await readJsonBody<Body>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const mediaId = optionalString(body.mediaId);
    const storagePath = optionalString(body.storagePath);
    const kind = normalizeMediaKind(body.kind);

    if (!mediaId || !storagePath) {
      sendError(response, 400, "media_upload_required", "mediaId and storagePath are required.");
      return;
    }

    const propertyObject = await prisma.propertyObject.findFirst({
      where: { id: objectId, ownerOrganization: { slug: organizationSlug } },
      include: { ownerOrganization: true, ownerOffice: true },
    });

    if (!propertyObject) {
      sendError(response, 404, "object_not_found", `Object '${objectId}' was not found for '${organizationSlug}'.`);
      return;
    }

    const expectedPrefix = [
      "organizations",
      propertyObject.ownerOrganizationId,
      "offices",
      propertyObject.ownerOfficeId,
      "objects",
      propertyObject.id,
    ].join("/");

    if (!storagePath.startsWith(`${expectedPrefix}/`)) {
      sendError(response, 400, "invalid_storage_path", "The uploaded media path does not belong to this object.");
      return;
    }

    const file = storageBucket.file(storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      sendError(response, 404, "uploaded_file_not_found", "Uploaded file was not found in Cloud Storage.");
      return;
    }

    const [metadata] = await file.getMetadata();
    const mimeType = metadata.contentType ?? "application/octet-stream";
    const sizeBytes = Number(metadata.size ?? 0);
    const maxBytes = maxUploadBytesForKind(kind);

    if (!allowedMimeForKind(kind, mimeType) || sizeBytes > maxBytes) {
      await file.delete({ ignoreNotFound: true });
      sendError(response, 400, "invalid_uploaded_file", "Uploaded file type or size is not allowed.");
      return;
    }

    const uploadedByEmail = optionalString(body.uploadedByEmail)?.toLowerCase();
    const uploadedByUser = uploadedByEmail
      ? await prisma.appUser.upsert({
          where: { email: uploadedByEmail },
          update: { active: true },
          create: {
            firebaseUid: `pending:${uploadedByEmail}`,
            email: uploadedByEmail,
            active: true,
          },
        })
      : null;

    const makeCover = booleanFromBody(body.makeCover);
    const mediaWrites = await prisma.$transaction([
      ...(makeCover
        ? [
            prisma.propertyMedia.updateMany({
              where: { propertyObjectId: propertyObject.id },
              data: { sortOrder: 100 },
            }),
          ]
        : []),
      prisma.propertyMedia.create({
        data: {
          id: mediaId,
          propertyObjectId: propertyObject.id,
          ownerOrganizationId: propertyObject.ownerOrganizationId,
          ownerOfficeId: propertyObject.ownerOfficeId,
          storagePath,
          url: null,
          kind: kind as never,
          public: booleanFromBody(body.public),
          sortOrder: makeCover ? 0 : 10,
          originalFileName: optionalString(body.originalFileName),
          mimeType,
          sizeBytes: BigInt(sizeBytes),
          checksum: typeof metadata.md5Hash === "string" ? metadata.md5Hash : null,
          title: optionalString(body.title),
          caption: optionalString(body.caption),
          uploadedByUserId: uploadedByUser?.id ?? null,
        },
      }),
    ]);
    const media = mediaWrites[mediaWrites.length - 1] as {
      id: string;
      kind: string;
      public: boolean;
    };

    sendJson(response, 201, {
      ok: true,
      media: {
        id: media.id,
        url: `/api/v1/admin/media/${encodeURIComponent(media.id)}`,
        kind: media.kind,
        public: media.public,
      },
    });
    return;
  }

  const objectMatch = url.pathname.match(/^\/api\/v1\/admin\/objects\/([^/]+)$/);

  if (objectMatch && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type UpdateObjectBody = {
      organizationSlug?: string;
      action?: "save" | "publish" | "unpublish" | "archive";
      marketSlug?: string;
      assetClass?: string;
      assetSubtype?: string;
      status?: string;
      visibility?: string;
      canBeShownByOtherOffices?: unknown;
      title?: string;
      titleEn?: string;
      description?: string;
      descriptionEn?: string;
      addressDisplay?: string;
      addressDisplayEn?: string;
      tags?: unknown;
      tagsEn?: unknown;
      areaSqm?: string;
      landAreaSqm?: string;
      buildingAreaSqm?: string;
      rentableAreaSqm?: string;
      cadastralNumber?: string;
      priceDisplay?: string;
      priceDisplayEn?: string;
      priceAmount?: string;
      priceCurrency?: string;
      mediaUrl?: string;
      clearMedia?: unknown;
    };

    const objectId = decodeURIComponent(objectMatch[1]);
    const body = await readJsonBody<UpdateObjectBody>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";

    const existing = await prisma.propertyObject.findFirst({
      where: { id: objectId, ownerOrganization: { slug: organizationSlug } },
      include: {
        ownerOrganization: true,
        ownerOffice: true,
        market: true,
        localizations: true,
      },
    });

    if (!existing) {
      sendError(response, 404, "object_not_found", `Object '${objectId}' was not found for '${organizationSlug}'.`);
      return;
    }

    const market = optionalString(body.marketSlug)
      ? await prisma.market.findUnique({ where: { slug: optionalString(body.marketSlug) } })
      : null;
    const action = body.action ?? "save";
    const status = action === "publish" ? "published" : action === "archive" ? "archived" : action === "unpublish" ? "draft" : optionalString(body.status);
    const visibility = action === "publish" ? "public" : action === "unpublish" ? "private" : optionalString(body.visibility);
    const mediaUrl = optionalString(body.mediaUrl);

    const updated = await prisma.propertyObject.update({
      where: { id: existing.id },
      data: {
        ...(market ? { marketId: market.id } : {}),
        ...(status ? { status: status as never } : {}),
        ...(visibility ? { visibility: visibility as never } : {}),
        ...(action === "publish" ? { publishedAt: new Date(), canBeShownByOtherOffices: true } : {}),
        ...(action === "unpublish" ? { publishedAt: null, canBeShownByOtherOffices: false } : {}),
        ...(action === "archive" ? { publishedAt: null, canBeShownByOtherOffices: false } : {}),
        ...(body.canBeShownByOtherOffices !== undefined && action === "save" ? { canBeShownByOtherOffices: booleanFromBody(body.canBeShownByOtherOffices) } : {}),
        ...(optionalString(body.assetClass) ? { assetClass: optionalString(body.assetClass) as never } : {}),
        assetSubtype: optionalString(body.assetSubtype) ?? null,
        areaSqm: optionalDecimal(body.areaSqm) ?? null,
        landAreaSqm: optionalDecimal(body.landAreaSqm) ?? null,
        buildingAreaSqm: optionalDecimal(body.buildingAreaSqm) ?? null,
        rentableAreaSqm: optionalDecimal(body.rentableAreaSqm) ?? null,
        cadastralNumber: optionalString(body.cadastralNumber) ?? null,
        priceMode: optionalDecimal(body.priceAmount) ? "fixed" : "on_request",
        priceAmount: optionalDecimal(body.priceAmount) ?? null,
        priceCurrency: optionalString(body.priceCurrency) as never,
      },
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (optionalString(body.title) && optionalString(body.addressDisplay)) {
      await prisma.propertyObjectLocalization.upsert({
        where: { propertyObjectId_language: { propertyObjectId: existing.id, language: "ru" } },
        update: {
          title: optionalString(body.title) ?? "",
          description: optionalString(body.description),
          addressDisplay: optionalString(body.addressDisplay) ?? "",
          tags: tagsFromBody(body.tags),
          priceDisplay: optionalString(body.priceDisplay),
        },
        create: {
          propertyObjectId: existing.id,
          language: "ru",
          title: optionalString(body.title) ?? "",
          description: optionalString(body.description),
          addressDisplay: optionalString(body.addressDisplay) ?? "",
          tags: tagsFromBody(body.tags),
          priceDisplay: optionalString(body.priceDisplay),
        },
      });

      await prisma.propertyObjectLocalization.upsert({
        where: { propertyObjectId_language: { propertyObjectId: existing.id, language: "en" } },
        update: {
          title: optionalString(body.titleEn) ?? optionalString(body.title) ?? "",
          description: optionalString(body.descriptionEn) ?? optionalString(body.description),
          addressDisplay: optionalString(body.addressDisplayEn) ?? optionalString(body.addressDisplay) ?? "",
          tags: tagsFromBody(body.tagsEn).length ? tagsFromBody(body.tagsEn) : tagsFromBody(body.tags),
          priceDisplay: optionalString(body.priceDisplayEn) ?? optionalString(body.priceDisplay),
        },
        create: {
          propertyObjectId: existing.id,
          language: "en",
          title: optionalString(body.titleEn) ?? optionalString(body.title) ?? "",
          description: optionalString(body.descriptionEn) ?? optionalString(body.description),
          addressDisplay: optionalString(body.addressDisplayEn) ?? optionalString(body.addressDisplay) ?? "",
          tags: tagsFromBody(body.tagsEn).length ? tagsFromBody(body.tagsEn) : tagsFromBody(body.tags),
          priceDisplay: optionalString(body.priceDisplayEn) ?? optionalString(body.priceDisplay),
        },
      });
    }

    if (booleanFromBody(body.clearMedia) || mediaUrl) {
      await prisma.propertyMedia.deleteMany({ where: { propertyObjectId: existing.id, kind: "image" } });
    }

    if (mediaUrl) {
      await prisma.propertyMedia.create({
        data: {
          propertyObjectId: existing.id,
          ownerOrganizationId: existing.ownerOrganizationId,
          ownerOfficeId: existing.ownerOfficeId,
          url: mediaUrl,
          kind: "image",
          public: true,
          sortOrder: 10,
        },
      });
    }

    sendJson(response, 200, { ok: true, object: serializeObject(updated as AdminObjectRow, "ru", "admin") });
    return;
  }

  sendJson(response, 404, {
    error: {
      code: "not_found",
      message: "Route is not implemented yet.",
      details: { service: serviceName, path: url.pathname },
    },
  });
});

server.listen(port, () => {
  console.log(`${serviceName} listening on ${port}`);
});
