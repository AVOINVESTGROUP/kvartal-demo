import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { Storage } from "@google-cloud/storage";
import PDFDocument from "pdfkit";
import { firebaseAdminAuth, resolveUserActor, structuredAuthError, type ActorContext, type ApiAuthPolicy } from "@kvartal/auth";
import { randomUUID as authRandomUUID } from "node:crypto";
import { handlePropertyIdentityRequest, readEffectivePropertyIdentityRollout, recordPropertyIdentityDriveDraft } from "./property-identity.js";

export const serviceName = "office-api";

export const ownedRoutes = [
  "/api/v1/public/objects",
  "/api/v1/public/media",
  "/api/v1/public/market-insights",
  "/api/v1/public/session-context",
  "/api/v1/public/ai-search",
  "/api/v1/public/client-intents",
  "/api/v1/platform/market-insights/refresh",
  "/api/v1/admin/intake/process-drive-folder",
  "/api/v1/admin/context",
  "/api/v1/admin/objects",
  "/api/v1/admin/media",
  "/api/v1/admin/documents",
  "/api/v1/admin/access-settings",
  "/api/v1/admin/partners",
  "/api/v1/admin/interactions",
  "/api/v1/admin/organization/notification-settings",
  "/api/v1/admin/interaction-templates",
  "/api/v1/admin/blocked-partners",
  "/api/v1/admin/partner-objects",
  "/api/v1/admin/partner-object-visibility",
  "/api/v1/admin/members",
  "/api/v1/admin/property-intakes",
  "/api/v1/admin/property-identity/submissions",
  "/api/v1/admin/client-intents",
  "/api/v1/admin/cobroker-requests",
  "/api/v1/admin/deal-rooms",
  "/api/v1/admin/actor-context",
] as const;

export const routeAuthPolicies: ReadonlyArray<{ matches: (path: string) => boolean; policy: ApiAuthPolicy }> = [
  { matches: (path) => path === "/healthz" || path === "/readyz" || path.startsWith("/api/v1/public/"), policy: "PUBLIC" },
  { matches: (path) => path === "/api/v1/admin/actor-context", policy: "ACTOR_AUTH_REQUIRED" },
  { matches: (path) => path.startsWith("/api/v1/admin/property-identity/"), policy: "ACTOR_AUTH_REQUIRED" },
  { matches: (path) => path === "/api/v1/platform/market-insights/refresh", policy: "LEGACY_SERVICE_AUTH" },
  { matches: (path) => path.startsWith("/api/v1/admin/"), policy: "LEGACY_SERVICE_AUTH" },
];

export function authPolicyForPath(path: string) { return routeAuthPolicies.find((entry) => entry.matches(path))?.policy; }

const port = Number(process.env.PORT ?? 8080);
const prisma = new PrismaClient();
const storage = new Storage();
const storageBucketName = process.env.STORAGE_BUCKET ?? "kvartal-dev-property-assets";
const storageBucket = storage.bucket(storageBucketName);
const interactionTypingTtlMs = 3000;
const supportedInteractionLanguages = new Set(["ru", "en", "zh", "ka", "hy", "ar"]);

type InteractionTranslationResult = {
  translatedText: string | null;
  translatedLanguage: "ru" | "en" | "zh" | "ka" | "hy" | "ar" | null;
  translationStatus: "pending" | "translated" | "failed" | "not_required" | "edited";
  provider: string | null;
};

type InteractionPdfRow = {
  id: string;
  type: string;
  priority: string;
  status: string;
  conversationLanguage: string;
  subject: string | null;
  initialMessage: string | null;
  dealRoomId: string | null;
  createdAt: Date;
  updatedAt: Date;
  initiatingOrganization: { legalName: string; slug: string };
  initiatingOffice: { legalName: string; slug: string };
  targetOrganization: { legalName: string; slug: string };
  targetOffice: { legalName: string; slug: string };
  propertyObject: PublicObjectRow;
  messages: Array<Parameters<typeof serializeInteractionMessage>[0]>;
  attachments: Array<Parameters<typeof serializeInteractionAttachment>[0]>;
  events: Array<{ id: string; eventType: string; payload: unknown; createdAt: Date }>;
};

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
const maxInteractionAttachmentBytes = 25 * 1024 * 1024;
const maxInteractionAttachmentCount = 5;
const maxInteractionAttachmentTotalBytes = 100 * 1024 * 1024;
const maxPropertyDocumentBytes = 50 * 1024 * 1024;
const supportedDriveDocumentMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
]);
const allowedInteractionAttachmentMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
]);
const allowedInteractionAttachmentExtensionsByMimeType = new Map([
  ["application/pdf", new Set([".pdf"])],
  ["application/msword", new Set([".doc"])],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Set([".docx"])],
  ["application/vnd.ms-excel", new Set([".xls"])],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new Set([".xlsx"])],
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/gif", new Set([".gif"])],
]);

function hasAllowedInteractionAttachmentExtension(fileName: string, mimeType: string) {
  const extension = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  const allowedExtensions = allowedInteractionAttachmentExtensionsByMimeType.get(mimeType);

  return Boolean(extension && allowedExtensions?.has(extension));
}

function matchesMagic(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

function hasAllowedInteractionAttachmentSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return matchesMagic(buffer, [0x25, 0x50, 0x44, 0x46]);
  if (mimeType === "image/jpeg") return matchesMagic(buffer, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return matchesMagic(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (mimeType === "application/msword" || mimeType === "application/vnd.ms-excel") return matchesMagic(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return matchesMagic(buffer, [0x50, 0x4b, 0x03, 0x04]) || matchesMagic(buffer, [0x50, 0x4b, 0x05, 0x06]) || matchesMagic(buffer, [0x50, 0x4b, 0x07, 0x08]);
  }

  return false;
}

async function readStorageFilePrefix(storagePath: string, byteLength = 16) {
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    storageBucket.file(storagePath)
      .createReadStream({ start: 0, end: byteLength - 1 })
      .on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      .on("end", resolve)
      .on("error", reject);
  });

  return Buffer.concat(chunks);
}

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
  aurum: "aurum-key-nyc",
  huajing: "huajing-estate",
} as const;

const supportedClientCurrencies = new Set(["RUB", "USD", "EUR", "GEL", "AMD", "AED"]);
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

function normalizeClientCurrency(currency: string | undefined | null, fallback = "USD") {
  const normalized = currency?.trim().toUpperCase();

  return supportedClientCurrencies.has(normalized ?? "") ? normalized : fallback;
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

const propertyDocumentTypeLabels: Record<string, string> = {
  ownership_certificate: "Свидетельство / выписка о собственности",
  cadastral_extract: "Кадастровая выписка",
  title_document: "Правоустанавливающий документ",
  lease_agreement: "Договор аренды",
  sale_purchase_agreement: "Договор купли-продажи",
  power_of_attorney: "Доверенность",
  corporate_document: "Корпоративные документы",
  passport_or_id: "Паспорт / ID",
  tax_document: "Налоговые документы",
  encumbrance_certificate: "Справка об обременениях",
  technical_passport: "Технический паспорт",
  floor_plan: "План / поэтажная схема",
  presentation: "Презентация",
  technical_report: "Технический отчет",
  explication: "Экспликация",
  certificate: "Сертификат / справка",
  permit: "Разрешение",
  due_diligence_report: "Due diligence отчет",
  valuation_report: "Оценочный отчет",
  other: "Другой документ",
};

const requiredDocumentTypesByAssetClass: Record<string, string[]> = {
  land: ["cadastral_extract", "title_document", "encumbrance_certificate", "permit"],
  apartment: ["ownership_certificate", "floor_plan", "technical_passport", "encumbrance_certificate"],
  house: ["ownership_certificate", "cadastral_extract", "technical_passport", "encumbrance_certificate"],
  office: ["title_document", "floor_plan", "technical_passport", "encumbrance_certificate"],
  retail: ["title_document", "floor_plan", "technical_passport", "permit"],
  warehouse: ["title_document", "technical_passport", "floor_plan", "permit"],
  industrial_site: ["cadastral_extract", "title_document", "technical_report", "permit", "encumbrance_certificate"],
  factory: ["title_document", "technical_report", "permit", "encumbrance_certificate"],
  hotel: ["title_document", "technical_passport", "floor_plan", "permit", "due_diligence_report"],
  mixed_use: ["title_document", "technical_passport", "floor_plan", "permit"],
  development_project: ["cadastral_extract", "title_document", "permit", "technical_report", "presentation"],
  investment_project: ["title_document", "valuation_report", "due_diligence_report", "presentation"],
  other: ["title_document", "technical_report", "presentation"],
};

function requiredDocumentTypesForAssetClass(assetClass: string) {
  return requiredDocumentTypesByAssetClass[assetClass] ?? requiredDocumentTypesByAssetClass.other;
}

function normalizePropertyDocumentType(value: unknown, fileName = "") {
  const text = `${optionalString(value) ?? ""} ${fileName}`.toLowerCase();

  if (/кадастр|cadastr|кадастров/.test(text)) return "cadastral_extract";
  if (/собствен|ownership|certificate/.test(text)) return "ownership_certificate";
  if (/правоустан|title/.test(text)) return "title_document";
  if (/аренд|lease/.test(text)) return "lease_agreement";
  if (/купл|продаж|purchase|sale/.test(text)) return "sale_purchase_agreement";
  if (/довер|attorney/.test(text)) return "power_of_attorney";
  if (/тех.*паспорт|technical.*passport/.test(text)) return "technical_passport";
  if (/план|floor/.test(text)) return "floor_plan";
  if (/экспликац|explication/.test(text)) return "explication";
  if (/обремен|encumbrance/.test(text)) return "encumbrance_certificate";
  if (/разреш|permit/.test(text)) return "permit";
  if (/оцен|valuation/.test(text)) return "valuation_report";
  if (/due|diligence|провер/.test(text)) return "due_diligence_report";
  if (/презентац|presentation/.test(text)) return "presentation";
  if (/отчет|report/.test(text)) return "technical_report";

  return "other";
}

function serializeJsonValue(value: unknown) {
  return value ?? null;
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

type PropertyDocumentVersionRow = {
  id: string;
  versionNumber: number;
  storagePath: string;
  originalFileName: string | null;
  mimeType: string | null;
  sizeBytes: bigint | number | null;
  checksum: string | null;
  driveModifiedTime: Date | null;
  driveChecksum: string | null;
  aiAnalysis: unknown;
  aiChangeSummary: unknown;
  comparedToVersion: number | null;
  createdAt: Date;
};

type PropertyDocumentRow = {
  id: string;
  title: string;
  storagePath: string;
  documentType: string;
  source: string;
  public: boolean;
  currentVersion: number;
  driveFileId: string | null;
  driveModifiedTime: Date | null;
  driveChecksum: string | null;
  driveWebUrl: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  sizeBytes: bigint | number | null;
  checksum: string | null;
  analysisStatus: string;
  aiSummary: unknown;
  aiFacts: unknown;
  aiRisks: unknown;
  aiRecommendations: unknown;
  aiMissingItems: unknown;
  aiConflicts: unknown;
  aiChangeSummary: unknown;
  aiAnalyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  versions?: PropertyDocumentVersionRow[];
};

type PropertyObjectAIAnalysisRow = {
  id: string;
  status: string;
  provider: string | null;
  model: string | null;
  summary: unknown;
  confirmedFacts: unknown;
  risks: unknown;
  recommendations: unknown;
  missingDocuments: unknown;
  conflicts: unknown;
  changeLog: unknown;
  fieldProposals: unknown;
  analyzedAt: Date;
  proposals?: Array<{
    id: string;
    fieldPath: string;
    currentValue: unknown;
    proposedValue: unknown;
    sourceDocumentIds: string[];
    confidence: string;
    rationale: string | null;
    status: string;
    createdAt: Date;
  }>;
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
  cadastralNumber: string | null;
  representationSide: string;
  requiresOwnerOfficeApprovalForLead: boolean;
  ownerOrganization: { slug: string; legalName: string };
  ownerOffice: { slug: string; legalName: string };
  informationOwnerOrganization: { slug: string; legalName: string };
  informationOwnerOffice: { slug: string; legalName: string };
  media: PublicObjectMediaRow[];
  documents?: PropertyDocumentRow[];
  aiAnalyses?: PropertyObjectAIAnalysisRow[];
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

function serializePropertyDocument(document: PropertyDocumentRow) {
  return {
    id: document.id,
    title: document.title,
    documentType: document.documentType,
    label: propertyDocumentTypeLabels[document.documentType] ?? propertyDocumentTypeLabels.other,
    source: document.source,
    public: document.public,
    currentVersion: document.currentVersion,
    url: `/api/v1/admin/documents/${encodeURIComponent(document.id)}`,
    driveFileId: document.driveFileId,
    driveModifiedTime: document.driveModifiedTime?.toISOString() ?? null,
    driveChecksum: document.driveChecksum,
    driveWebUrl: document.driveWebUrl,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes === null || document.sizeBytes === undefined ? null : Number(document.sizeBytes),
    checksum: document.checksum,
    analysisStatus: document.analysisStatus,
    aiSummary: serializeJsonValue(document.aiSummary),
    aiFacts: serializeJsonValue(document.aiFacts),
    aiRisks: serializeJsonValue(document.aiRisks),
    aiRecommendations: serializeJsonValue(document.aiRecommendations),
    aiMissingItems: serializeJsonValue(document.aiMissingItems),
    aiConflicts: serializeJsonValue(document.aiConflicts),
    aiChangeSummary: serializeJsonValue(document.aiChangeSummary),
    aiAnalyzedAt: document.aiAnalyzedAt?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    versions: (document.versions ?? []).map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      originalFileName: version.originalFileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes === null || version.sizeBytes === undefined ? null : Number(version.sizeBytes),
      checksum: version.checksum,
      driveModifiedTime: version.driveModifiedTime?.toISOString() ?? null,
      driveChecksum: version.driveChecksum,
      aiAnalysis: serializeJsonValue(version.aiAnalysis),
      aiChangeSummary: serializeJsonValue(version.aiChangeSummary),
      comparedToVersion: version.comparedToVersion,
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

function documentCompletenessForObject(object: { assetClass: string; documents?: PropertyDocumentRow[] }) {
  const requiredTypes = requiredDocumentTypesForAssetClass(object.assetClass);
  const documents = object.documents ?? [];
  const presentTypes = new Set(documents.map((document) => document.documentType));
  const required = requiredTypes.map((type) => ({
    type,
    label: propertyDocumentTypeLabels[type] ?? type,
    status: presentTypes.has(type) ? "present" : "missing",
    documentIds: documents.filter((document) => document.documentType === type).map((document) => document.id),
  }));
  const missing = required.filter((item) => item.status === "missing");

  return {
    required,
    requiredCount: required.length,
    presentCount: required.length - missing.length,
    missingCount: missing.length,
    score: required.length ? Math.round(((required.length - missing.length) / required.length) * 100) : 100,
  };
}

function serializePropertyObjectAIAnalysis(analysis: PropertyObjectAIAnalysisRow | undefined) {
  if (!analysis) {
    return null;
  }

  return {
    id: analysis.id,
    status: analysis.status,
    provider: analysis.provider,
    model: analysis.model,
    summary: serializeJsonValue(analysis.summary),
    confirmedFacts: serializeJsonValue(analysis.confirmedFacts),
    risks: serializeJsonValue(analysis.risks),
    recommendations: serializeJsonValue(analysis.recommendations),
    missingDocuments: serializeJsonValue(analysis.missingDocuments),
    conflicts: serializeJsonValue(analysis.conflicts),
    changeLog: serializeJsonValue(analysis.changeLog),
    fieldProposals: serializeJsonValue(analysis.fieldProposals),
    analyzedAt: analysis.analyzedAt.toISOString(),
    proposals: (analysis.proposals ?? []).map((proposal) => ({
      id: proposal.id,
      fieldPath: proposal.fieldPath,
      currentValue: serializeJsonValue(proposal.currentValue),
      proposedValue: serializeJsonValue(proposal.proposedValue),
      sourceDocumentIds: proposal.sourceDocumentIds,
      confidence: proposal.confidence,
      rationale: proposal.rationale,
      status: proposal.status,
      createdAt: proposal.createdAt.toISOString(),
    })),
  };
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
    cadastralNumber: object.cadastralNumber,
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
    documents: (object.documents ?? []).map(serializePropertyDocument),
    documentCompleteness: documentCompletenessForObject(object),
    aiDossier: serializePropertyObjectAIAnalysis(object.aiAnalyses?.[0]),
    publishedAt: object.publishedAt?.toISOString() ?? null,
  };
}

type InteractionSideContext = {
  organization: { id: string; slug: string; legalName: string; defaultLanguage: string; defaultCurrency: string };
  office: { id: string; slug: string; legalName: string; defaultLanguage: string };
};

async function getInteractionSideContext(organizationSlug: string, officeSlug?: string): Promise<InteractionSideContext | null> {
  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    include: {
      offices: {
        where: officeSlug ? { slug: officeSlug } : undefined,
        orderBy: { legalName: "asc" },
        take: 1,
      },
    },
  });

  const office = organization?.offices[0];

  if (!organization || !office) {
    return null;
  }

  return {
    organization: {
      id: organization.id,
      slug: organization.slug,
      legalName: organization.legalName,
      defaultLanguage: organization.defaultLanguage,
      defaultCurrency: organization.defaultCurrency,
    },
    office: {
      id: office.id,
      slug: office.slug,
      legalName: office.legalName,
      defaultLanguage: office.defaultLanguage,
    },
  };
}

async function upsertInteractionActor(email: string | undefined, displayName?: string) {
  const normalizedEmail = email?.trim().toLowerCase() || "partner-interactions@fixer.guru";

  return prisma.appUser.upsert({
    where: { email: normalizedEmail },
    update: { displayName: displayName || undefined, active: true },
    create: {
      firebaseUid: normalizedEmail === "partner-interactions@fixer.guru" ? "partner-interactions-system-user" : `pending:${normalizedEmail}`,
      email: normalizedEmail,
      displayName,
      active: true,
    },
  });
}

function canAccessInteraction(
  interaction: { initiatingOrganizationId: string; targetOrganizationId: string; initiatingOfficeId: string; targetOfficeId: string },
  context: InteractionSideContext,
) {
  return (
    interaction.initiatingOrganizationId === context.organization.id ||
    interaction.targetOrganizationId === context.organization.id ||
    interaction.initiatingOfficeId === context.office.id ||
    interaction.targetOfficeId === context.office.id
  );
}

type InteractionNotificationInput = {
  interactionId: string;
  messageId?: string | null;
  recipientOrganizationId: string;
  recipientOfficeId: string;
  eventType: string;
  title: string;
  body: string;
  priority?: string;
};

async function sendTelegramNotification(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const payload = await response.json() as { ok?: boolean; result?: { message_id?: number }; description?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram sendMessage failed with ${response.status}.`);
  }

  return payload.result?.message_id ? String(payload.result.message_id) : null;
}

async function sendWhatsappNotification(to: string, text: string, templateName?: string | null) {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v24.0";

  if (!token || !phoneNumberId) {
    throw new Error("WHATSAPP_CLOUD_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured.");
  }

  const body = templateName
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: text.slice(0, 1024) }],
            },
          ],
        },
      }
    : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      };

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } };

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `WhatsApp Cloud API send failed with ${response.status}.`);
  }

  return payload.messages?.[0]?.id ?? null;
}

async function deliverInteractionNotification(notification: {
  id: string;
  channel: string;
  title: string;
  body: string;
  attemptCount: number;
  recipientOrganizationId: string;
}) {
  const settings = await prisma.interactionNotificationSetting.findUnique({
    where: { organizationId: notification.recipientOrganizationId },
  });
  const text = `${notification.title}\n\n${notification.body}`;

  try {
    let providerMessageId: string | null = null;

    if (notification.channel === "in_admin") {
      await prisma.interactionNotification.update({
        where: { id: notification.id },
        data: { status: "sent", sentAt: new Date(), attemptCount: { increment: 1 } },
      });
      return;
    }

    if (notification.channel === "telegram") {
      if (!settings?.telegramEnabled || !settings.telegramChatId) {
        await prisma.interactionNotification.update({
          where: { id: notification.id },
          data: { status: "suppressed", providerError: "Telegram notifications are disabled or chat id is missing.", attemptCount: { increment: 1 } },
        });
        return;
      }

      providerMessageId = await sendTelegramNotification(settings.telegramChatId, text);
    }

    if (notification.channel === "whatsapp") {
      if (!settings?.whatsappEnabled || !settings.whatsappPhoneE164) {
        await prisma.interactionNotification.update({
          where: { id: notification.id },
          data: { status: "suppressed", providerError: "WhatsApp notifications are disabled or phone is missing.", attemptCount: { increment: 1 } },
        });
        return;
      }

      providerMessageId = await sendWhatsappNotification(settings.whatsappPhoneE164, text, settings.whatsappTemplateName);
    }

    await prisma.interactionNotification.update({
      where: { id: notification.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        providerMessageId,
        providerError: null,
        attemptCount: { increment: 1 },
      },
    });
  } catch (error) {
    await prisma.interactionNotification.update({
      where: { id: notification.id },
      data: {
        status: "failed",
        providerError: error instanceof Error ? error.message : "notification_failed",
        attemptCount: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** Math.min(notification.attemptCount, 6)) * 60 * 1000),
      },
    });
  }
}

async function createInteractionNotifications(input: InteractionNotificationInput) {
  const settings = await prisma.interactionNotificationSetting.findUnique({
    where: { organizationId: input.recipientOrganizationId },
  });
  const channels: Array<"in_admin" | "telegram" | "whatsapp"> = [];

  if (settings?.inAdminEnabled ?? true) channels.push("in_admin");

  const externalAllowed = input.priority === "urgent" || input.priority === "critical" || (settings?.urgentExternalEnabled ?? true);
  if (externalAllowed && settings?.telegramEnabled) channels.push("telegram");
  if (externalAllowed && settings?.whatsappEnabled) channels.push("whatsapp");

  const notifications = await prisma.$transaction(
    channels.map((channel) =>
      prisma.interactionNotification.create({
        data: {
          interactionId: input.interactionId,
          messageId: input.messageId ?? null,
          recipientOrganizationId: input.recipientOrganizationId,
          recipientOfficeId: input.recipientOfficeId,
          channel,
          eventType: input.eventType,
          status: "pending",
          title: input.title,
          body: input.body,
        },
      }),
    ),
  );

  for (const notification of notifications) {
    await deliverInteractionNotification(notification);
  }
}

function queueInteractionNotifications(input: InteractionNotificationInput) {
  void createInteractionNotifications(input).catch((error) => {
    console.error("interaction_notification_failed", error);
  });
}

function serializeInteractionMessage(
  message: {
    id: string;
    senderOrganizationId: string;
    originalText: string;
    originalLanguage: string;
    translatedText: string | null;
    translatedLanguage: string | null;
    translationStatus: string;
    deliveryStatus: string;
    readAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    senderOrganization: { legalName: string; slug: string };
    senderOffice: { legalName: string; slug: string };
  },
  viewerOrganizationId: string,
) {
  const deletedForViewer = Boolean(message.deletedAt) && message.senderOrganizationId !== viewerOrganizationId;

  return {
    id: message.id,
    sender: {
      organizationSlug: message.senderOrganization.slug,
      organizationName: message.senderOrganization.legalName,
      officeSlug: message.senderOffice.slug,
      officeName: message.senderOffice.legalName,
      ownOrganization: message.senderOrganizationId === viewerOrganizationId,
    },
    originalText: deletedForViewer ? "[Сообщение удалено]" : message.originalText,
    originalLanguage: message.originalLanguage,
    translatedText: deletedForViewer ? null : message.translatedText,
    translatedLanguage: message.translatedLanguage,
    translationStatus: message.translationStatus,
    deliveryStatus: message.deliveryStatus,
    readAt: message.readAt?.toISOString() ?? null,
    deleted: Boolean(message.deletedAt),
    createdAt: message.createdAt.toISOString(),
  };
}

function serializeInteractionAttachment(attachment: {
  id: string;
  messageId: string | null;
  originalFileName: string;
  mimeType: string;
  sizeBytes: bigint;
  scanStatus: string;
  deletedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: attachment.id,
    messageId: attachment.messageId,
    originalFileName: attachment.originalFileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes.toString(),
    scanStatus: attachment.scanStatus,
    deleted: Boolean(attachment.deletedAt),
    url: `/api/v1/admin/interactions/attachments/${encodeURIComponent(attachment.id)}`,
    createdAt: attachment.createdAt.toISOString(),
  };
}

function serializePartnerInteraction(interaction: {
  id: string;
  type: string;
  priority: string;
  status: string;
  conversationLanguage: string;
  subject: string | null;
  initialMessage: string | null;
  firstTargetResponseAt: Date | null;
  remindedAt: Date | null;
  escalatedAt: Date | null;
  completedAt?: Date | null;
  archivedAt: Date | null;
  dealRoomId: string | null;
  createdAt: Date;
  updatedAt: Date;
  initiatingOrganization: { slug: string; legalName: string };
  initiatingOffice: { slug: string; legalName: string };
  targetOrganization: { slug: string; legalName: string };
  targetOffice: { slug: string; legalName: string };
  propertyObject: PublicObjectRow;
  messages?: Array<Parameters<typeof serializeInteractionMessage>[0]>;
  attachments?: Array<Parameters<typeof serializeInteractionAttachment>[0]>;
  reviews?: Array<{
    id: string;
    reviewerOrganizationId: string;
    reviewedOrganizationId: string;
    rating: number;
    text: string | null;
    hiddenByPlatform: boolean;
    createdAt: Date;
    updatedAt: Date;
    reviewerOrganization: { slug: string; legalName: string };
    reviewedOrganization: { slug: string; legalName: string };
  }>;
  events?: Array<{ id: string; eventType: string; payload: unknown; createdAt: Date }>;
}, viewerOrganizationId: string, language = "ru") {
  return {
    id: interaction.id,
    type: interaction.type,
    priority: interaction.priority,
    status: interaction.status,
    conversationLanguage: interaction.conversationLanguage,
    subject: interaction.subject,
    initialMessage: interaction.initialMessage,
    firstTargetResponseAt: interaction.firstTargetResponseAt?.toISOString() ?? null,
    remindedAt: interaction.remindedAt?.toISOString() ?? null,
    escalatedAt: interaction.escalatedAt?.toISOString() ?? null,
    completedAt: interaction.completedAt?.toISOString() ?? null,
    archivedAt: interaction.archivedAt?.toISOString() ?? null,
    dealRoomId: interaction.dealRoomId,
    createdAt: interaction.createdAt.toISOString(),
    updatedAt: interaction.updatedAt.toISOString(),
    initiatingPartner: {
      organizationSlug: interaction.initiatingOrganization.slug,
      organizationName: interaction.initiatingOrganization.legalName,
      officeSlug: interaction.initiatingOffice.slug,
      officeName: interaction.initiatingOffice.legalName,
    },
    targetPartner: {
      organizationSlug: interaction.targetOrganization.slug,
      organizationName: interaction.targetOrganization.legalName,
      officeSlug: interaction.targetOffice.slug,
      officeName: interaction.targetOffice.legalName,
    },
    object: serializeObject(interaction.propertyObject, language, "admin"),
    messages: interaction.messages?.map((message) => serializeInteractionMessage(message, viewerOrganizationId)) ?? [],
    attachments: interaction.attachments?.map((attachment) => serializeInteractionAttachment(attachment)) ?? [],
    reviews: interaction.reviews?.map((review) => ({
      id: review.id,
      reviewer: {
        organizationSlug: review.reviewerOrganization.slug,
        organizationName: review.reviewerOrganization.legalName,
        ownOrganization: review.reviewerOrganizationId === viewerOrganizationId,
      },
      reviewed: {
        organizationSlug: review.reviewedOrganization.slug,
        organizationName: review.reviewedOrganization.legalName,
      },
      rating: review.rating,
      text: review.hiddenByPlatform ? null : review.text,
      hiddenByPlatform: review.hiddenByPlatform,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    })) ?? [],
    events: interaction.events?.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    })) ?? [],
  };
}

const partnerInteractionStatusTransitions = new Map<string, Set<string>>([
  ["new_request", new Set(["waiting_response", "accepted", "declined", "archived"])],
  ["waiting_response", new Set(["information_received", "accepted", "declined", "archived"])],
  ["information_received", new Set(["waiting_response", "accepted", "declined", "archived"])],
  ["accepted", new Set(["in_deal", "completed", "archived"])],
  ["declined", new Set(["archived"])],
  ["in_deal", new Set(["completed", "archived"])],
  ["completed", new Set(["archived"])],
  ["archived", new Set<string>()],
]);

function canTransitionPartnerInteractionStatus(currentStatus: string, nextStatus: string) {
  return currentStatus === nextStatus || (partnerInteractionStatusTransitions.get(currentStatus)?.has(nextStatus) ?? false);
}

function normalizeInteractionLanguage(language: string | undefined | null, fallback = "ru") {
  const normalized = language?.trim().toLowerCase();

  return supportedInteractionLanguages.has(normalized ?? "")
    ? normalized as "ru" | "en" | "zh" | "ka" | "hy" | "ar"
    : fallback as "ru" | "en" | "zh" | "ka" | "hy" | "ar";
}

function interactionTranslationHash(text: string) {
  return createHash("sha256").update(text.trim()).digest("hex");
}

async function translateInteractionText(text: string, sourceLanguage: string, targetLanguage: string): Promise<InteractionTranslationResult> {
  const normalizedSourceLanguage = normalizeInteractionLanguage(sourceLanguage);
  const normalizedTargetLanguage = normalizeInteractionLanguage(targetLanguage);

  if (!text.trim() || normalizedSourceLanguage === normalizedTargetLanguage) {
    return {
      translatedText: null,
      translatedLanguage: null,
      translationStatus: "not_required" as const,
      provider: null,
    };
  }

  const provider = `gemini:${process.env.GEMINI_MODEL ?? "gemini-2.5-flash"}`;
  const sourceHash = interactionTranslationHash(text);
  const cached = await prisma.interactionTranslationCache.findUnique({
    where: {
      sourceHash_sourceLanguage_targetLanguage_provider: {
        sourceHash,
        sourceLanguage: normalizedSourceLanguage,
        targetLanguage: normalizedTargetLanguage,
        provider,
      },
    },
  });

  if (cached) {
    return {
      translatedText: cached.translatedText,
      translatedLanguage: normalizedTargetLanguage,
      translationStatus: "translated" as const,
      provider,
    };
  }

  const prompt = [
    "Return only valid JSON, no markdown.",
    "Translate the text for a real-estate partner interaction.",
    "Preserve numbers, object names, addresses, legal terms, URLs, emails, phone numbers, line breaks, and tone.",
    "Do not add explanations, disclaimers, or facts.",
    `Source language: ${normalizedSourceLanguage}.`,
    `Target language: ${normalizedTargetLanguage}.`,
    'Shape: {"translatedText":"..."}',
    "Text:",
    text,
  ].join("\n");

  const parsed = parseGeminiJson(await callGemini(prompt)) as { translatedText?: string };
  const translatedText = optionalString(parsed.translatedText);

  if (!translatedText) {
    throw new Error("Gemini translation response did not include translatedText.");
  }

  await prisma.interactionTranslationCache.upsert({
    where: {
      sourceHash_sourceLanguage_targetLanguage_provider: {
        sourceHash,
        sourceLanguage: normalizedSourceLanguage,
        targetLanguage: normalizedTargetLanguage,
        provider,
      },
    },
    update: { translatedText, providerMetadata: { model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash" } },
    create: {
      sourceHash,
      sourceLanguage: normalizedSourceLanguage,
      targetLanguage: normalizedTargetLanguage,
      translatedText,
      provider,
      providerMetadata: { model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash" },
    },
  });

  return {
    translatedText,
    translatedLanguage: normalizedTargetLanguage,
    translationStatus: "translated" as const,
    provider,
  };
}

function formatPdfDate(value: Date | null | undefined) {
  return value ? value.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC") : "-";
}

function addPdfSection(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(13).text(title);
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(10);
}

function addPdfKeyValue(doc: PDFKit.PDFDocument, key: string, value: string | null | undefined) {
  doc.font("Helvetica-Bold").text(`${key}: `, { continued: true });
  doc.font("Helvetica").text(value || "-");
}

async function generateInteractionPdfBuffer(interaction: InteractionPdfRow, viewerOrganizationId: string, language: string) {
  const serialized = serializePartnerInteraction(interaction as never, viewerOrganizationId, language);
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Partner interaction ${interaction.id}` } });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(18).text("Partner Interaction History");
  doc.font("Helvetica").fontSize(9).text(`Generated: ${formatPdfDate(new Date())}`);
  doc.text(`Interaction ID: ${interaction.id}`);

  addPdfSection(doc, "Summary");
  addPdfKeyValue(doc, "Subject", interaction.subject ?? serialized.object.title);
  addPdfKeyValue(doc, "Status", interaction.status);
  addPdfKeyValue(doc, "Type", interaction.type);
  addPdfKeyValue(doc, "Priority", interaction.priority);
  addPdfKeyValue(doc, "Language", interaction.conversationLanguage);
  addPdfKeyValue(doc, "Created", formatPdfDate(interaction.createdAt));
  addPdfKeyValue(doc, "Updated", formatPdfDate(interaction.updatedAt));
  addPdfKeyValue(doc, "Deal room", interaction.dealRoomId);

  addPdfSection(doc, "Participants");
  addPdfKeyValue(doc, "Initiating organization", `${interaction.initiatingOrganization.legalName} / ${interaction.initiatingOffice.legalName}`);
  addPdfKeyValue(doc, "Target organization", `${interaction.targetOrganization.legalName} / ${interaction.targetOffice.legalName}`);

  addPdfSection(doc, "Object");
  addPdfKeyValue(doc, "Title", serialized.object.title);
  addPdfKeyValue(doc, "Address", serialized.object.addressDisplay);
  addPdfKeyValue(doc, "Market", `${serialized.object.market.city}, ${serialized.object.market.country}`);
  addPdfKeyValue(doc, "Price", serialized.object.priceDisplay ?? serialized.object.priceAmount);

  addPdfSection(doc, "Messages");
  const activeMessages = interaction.messages.filter((message) => !message.deletedAt);

  if (!activeMessages.length) {
    doc.text("No active messages.");
  }

  for (const message of activeMessages) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(10).text(`${formatPdfDate(message.createdAt)} - ${message.senderOrganization.legalName} / ${message.senderOffice.legalName}`);
    doc.font("Helvetica").fontSize(10).text(`[${message.originalLanguage}] ${message.originalText}`);

    if (message.translatedText) {
      doc.moveDown(0.2);
      doc.font("Helvetica-Oblique").text(`[${message.translatedLanguage ?? interaction.conversationLanguage}] ${message.translatedText}`);
      doc.font("Helvetica").text(`Translation status: ${message.translationStatus}`);
    }
  }

  addPdfSection(doc, "Attachments");
  const activeAttachments = interaction.attachments.filter((attachment) => !attachment.deletedAt);

  if (!activeAttachments.length) {
    doc.text("No active attachments.");
  }

  for (const attachment of activeAttachments) {
    doc.text(`${attachment.originalFileName} / ${attachment.mimeType} / ${attachment.sizeBytes.toString()} bytes / scan=${attachment.scanStatus}`);
  }

  addPdfSection(doc, "Events");

  if (!interaction.events.length) {
    doc.text("No events.");
  }

  for (const event of interaction.events) {
    doc.font("Helvetica-Bold").text(`${formatPdfDate(event.createdAt)} - ${event.eventType}`);
    doc.font("Helvetica").fontSize(8).text(JSON.stringify(event.payload ?? {}));
    doc.fontSize(10);
  }

  doc.end();
  return finished;
}

async function saveInteractionPdf(interactionId: string, pdfBuffer: Buffer) {
  const storagePath = ["interactions", interactionId, "exports", `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.pdf`].join("/");
  const file = storageBucket.file(storagePath);

  await file.save(pdfBuffer, {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=300",
    },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });

  return { storagePath, signedUrl };
}

async function setInteractionTyping(interactionId: string, context: InteractionSideContext) {
  await prisma.interactionTypingState.upsert({
    where: {
      interactionId_organizationId_officeId: {
        interactionId,
        organizationId: context.organization.id,
        officeId: context.office.id,
      },
    },
    update: { expiresAt: new Date(Date.now() + interactionTypingTtlMs) },
    create: {
      interactionId,
      organizationId: context.organization.id,
      officeId: context.office.id,
      expiresAt: new Date(Date.now() + interactionTypingTtlMs),
    },
  });
}

async function getInteractionTyping(interactionId: string, viewerOrganizationId: string) {
  const now = new Date();
  await prisma.interactionTypingState.deleteMany({
    where: {
      interactionId,
      expiresAt: { lte: now },
    },
  });

  const active = await prisma.interactionTypingState.findMany({
    where: {
      interactionId,
      expiresAt: { gt: now },
      organizationId: { not: viewerOrganizationId },
    },
    include: {
      organization: true,
      office: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return active.map((item) => ({
    organizationName: item.organization.legalName,
    officeName: item.office.legalName,
    expiresAt: item.expiresAt.toISOString(),
  }));
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

async function callGemini(prompt: string, fileParts?: Array<{ fileData: { mimeType: string; fileUri: string } }>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const headers: Record<string, string> = { "content-type": "application/json" };
  let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey ?? "")}`;

  if (!apiKey) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "kvartal-dev";
    const location = process.env.VERTEX_AI_LOCATION ?? "europe-west4";
    const host = `${location}-aiplatform.googleapis.com`;
    const tokenRes = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" },
    });

    if (!tokenRes.ok) throw new Error("Neither GEMINI_API_KEY nor Vertex AI metadata token available.");
    const tokenPayload = await tokenRes.json() as { access_token?: string };
    if (!tokenPayload.access_token) throw new Error("Vertex AI token missing access_token.");
    headers.authorization = `Bearer ${tokenPayload.access_token}`;
    endpoint = `https://${host}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [...(fileParts ?? []), { text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
  const payload = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  md5Checksum?: string;
  webViewLink?: string;
};

type DownloadedDriveFile = {
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
};

async function downloadDriveFile(file: DriveFile, driveToken: string): Promise<DownloadedDriveFile | null> {
  const exportTypes: Record<string, { mimeType: string; extension: string }> = {
    "application/vnd.google-apps.document": { mimeType: "application/pdf", extension: "pdf" },
    "application/vnd.google-apps.spreadsheet": { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" },
  };
  const exportType = exportTypes[file.mimeType];
  const endpoint = exportType
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportType.mimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
  const downloadResponse = await fetch(endpoint, { headers: { Authorization: `Bearer ${driveToken}` } });

  if (!downloadResponse.ok) {
    return null;
  }

  const mimeType = exportType?.mimeType ?? file.mimeType;
  const baseName = file.name.replace(/\.[a-z0-9]+$/i, "");
  const extension = exportType?.extension ?? extensionForFileName(file.name, mimeType);

  return {
    buffer: Buffer.from(await downloadResponse.arrayBuffer()),
    mimeType,
    originalFileName: exportType ? `${baseName}.${extension}` : file.name,
  };
}

async function uploadBufferToGeminiFile(fileName: string, mimeType: string, buffer: Buffer) {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    return null;
  }

  const uploadResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "multipart/related; boundary=boundary" },
      body: Buffer.concat([
        Buffer.from(`--boundary\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ file: { displayName: fileName } })}\r\n--boundary\r\nContent-Type: ${mimeType}\r\n\r\n`),
        buffer,
        Buffer.from("\r\n--boundary--"),
      ]),
    },
  );

  if (!uploadResponse.ok) {
    return null;
  }

  const uploadPayload = await uploadResponse.json() as { file?: { uri?: string; mimeType?: string } };

  return uploadPayload.file?.uri ? { fileData: { mimeType: uploadPayload.file.mimeType ?? mimeType, fileUri: uploadPayload.file.uri } } : null;
}

function fallbackDocumentAnalysis(fileName: string, documentType: string, versionNumber: number, changed: boolean) {
  return {
    summary: `Документ "${fileName}" сохранен в системное досье объекта. AI-анализ будет дополнен после доступного Gemini file processing.`,
    facts: [{ field: "documentType", value: documentType, confidence: "medium", source: fileName }],
    risks: [],
    recommendations: changed
      ? ["Проверить изменения в новой версии документа и подтвердить влияние на карточку объекта."]
      : ["Проверить документ и при необходимости подтвердить извлеченные данные."],
    missingItems: [],
    conflicts: [],
    changeSummary: changed ? [{ version: versionNumber, change: "Загружена новая версия документа." }] : [],
  };
}

function normalizeAIArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function analyzeObjectDocumentsWithAI(params: {
  propertyObject: {
    id: string;
    assetClass: string;
    assetSubtype: string | null;
    areaSqm: unknown;
    landAreaSqm: unknown;
    buildingAreaSqm: unknown;
    cadastralNumber: string | null;
    priceAmount: unknown;
    priceCurrency: string | null;
    ownerOrganizationId: string;
    ownerOfficeId: string;
    localizations: PublicObjectLocalizationRow[];
  };
  documents: PropertyDocumentRow[];
  geminiFileParts: Array<{ fileData: { mimeType: string; fileUri: string } }>;
}) {
  const { propertyObject, documents, geminiFileParts } = params;
  const currentLocalization = propertyObject.localizations.find((item) => item.language === "ru") ?? propertyObject.localizations[0];
  const requiredTypes = requiredDocumentTypesForAssetClass(propertyObject.assetClass);
  const documentContext = documents.map((document) => ({
    id: document.id,
    title: document.title,
    type: document.documentType,
    version: document.currentVersion,
    fileName: document.originalFileName,
    analysis: document.aiSummary,
  }));
  const currentObject = {
    title: currentLocalization?.title ?? null,
    description: currentLocalization?.description ?? null,
    addressDisplay: currentLocalization?.addressDisplay ?? null,
    assetClass: propertyObject.assetClass,
    assetSubtype: propertyObject.assetSubtype,
    areaSqm: decimalToString(propertyObject.areaSqm),
    landAreaSqm: decimalToString(propertyObject.landAreaSqm),
    buildingAreaSqm: decimalToString(propertyObject.buildingAreaSqm),
    cadastralNumber: propertyObject.cadastralNumber,
    priceAmount: decimalToString(propertyObject.priceAmount),
    priceCurrency: propertyObject.priceCurrency,
  };
  const fallback = {
    summary: {
      short: "Документы импортированы в системное досье. Требуется AI-анализ или ручная проверка.",
      known: [],
      confirmed: [],
      questions: [],
      nextActions: ["Проверить комплектность документов и подтвердить изменения карточки объекта."],
    },
    confirmedFacts: [],
    risks: [],
    recommendations: ["Проверить недостающие документы по чеклисту объекта."],
    missingDocuments: requiredTypes
      .filter((type) => !documents.some((document) => document.documentType === type))
      .map((type) => ({ type, label: propertyDocumentTypeLabels[type] ?? type })),
    conflicts: [],
    changeLog: [],
    fieldProposals: [],
  };

  if (!geminiFileParts.length) {
    return fallback;
  }

  const prompt = [
    "You are an AI document intelligence assistant for a real estate admin system.",
    "Return ONLY valid JSON. Do not use markdown.",
    "Analyze the attached documents and the stored document metadata.",
    "Do not make legal conclusions. Use careful wording: risks, questions, recommendations.",
    "Suggest changes to object fields only as proposals requiring human approval.",
    `Current object JSON: ${JSON.stringify(currentObject)}`,
    `Required document types: ${JSON.stringify(requiredTypes)}`,
    `Document registry JSON: ${JSON.stringify(documentContext)}`,
    'Shape: {"summary":{"short":"string","known":["string"],"confirmed":["string"],"questions":["string"],"nextActions":["string"]},"confirmedFacts":[{"field":"string","value":"string","confidence":"high|medium|low","sourceDocumentId":"string|null"}],"risks":[{"severity":"low|medium|high","text":"string","sourceDocumentId":"string|null"}],"recommendations":["string"],"missingDocuments":[{"type":"string","reason":"string"}],"conflicts":[{"field":"string","currentValue":"string|null","documentValue":"string|null","sourceDocumentId":"string|null","note":"string"}],"changeLog":[{"documentId":"string","text":"string"}],"fieldProposals":[{"fieldPath":"title|description|addressDisplay|assetSubtype|areaSqm|landAreaSqm|buildingAreaSqm|cadastralNumber|priceAmount|priceCurrency|priceDisplay","currentValue":"string|null","proposedValue":"string|null","confidence":"high|medium|low","rationale":"string","sourceDocumentIds":["string"]}]}',
  ].join("\n");

  try {
    const result = parseGeminiJson(await callGemini(prompt, geminiFileParts)) as Record<string, unknown>;

    return {
      summary: result.summary ?? fallback.summary,
      confirmedFacts: normalizeAIArray(result.confirmedFacts),
      risks: normalizeAIArray(result.risks),
      recommendations: normalizeAIArray(result.recommendations),
      missingDocuments: normalizeAIArray(result.missingDocuments),
      conflicts: normalizeAIArray(result.conflicts),
      changeLog: normalizeAIArray(result.changeLog),
      fieldProposals: normalizeAIArray(result.fieldProposals),
    };
  } catch {
    return fallback;
  }
}

// Exchange rates cache: { rates: Record<string,number>, fetchedAt: number }
let exchangeRatesCache: { rates: Record<string, number>; fetchedAt: number } | null = null;

async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (exchangeRatesCache && now - exchangeRatesCache.fetchedAt < 24 * 60 * 60 * 1000) {
    return exchangeRatesCache.rates;
  }

  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (!res.ok) throw new Error("Exchange rate fetch failed");
    const data = await res.json() as { rates?: Record<string, number> };
    const rates = data.rates ?? {};
    exchangeRatesCache = { rates, fetchedAt: now };
    return rates;
  } catch {
    return exchangeRatesCache?.rates ?? {};
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const correlationId = typeof request.headers["x-correlation-id"] === "string" ? request.headers["x-correlation-id"] : authRandomUUID();
  const policy = authPolicyForPath(url.pathname);
  let actorContext: ActorContext | null = null;
  if (!policy) { sendError(response, 500, "DEPLOYMENT_PREREQUISITE_MISSING", "Route authentication policy is missing."); return; }
  if (policy === "ACTOR_AUTH_REQUIRED") {
    try {
      const actor = await resolveUserActor({
        authorization: request.headers.authorization, correlationId,
        verifySession: (token, checkRevoked) => firebaseAdminAuth().verifySessionCookie(token, checkRevoked),
        findIdentity: async (provider, subject) => prisma.appUserExternalIdentity.findUnique({
          where: { provider_subject: { provider, subject } },
          include: { appUser: { include: { platformRoleAssignments: true, organizationMemberships: true, officeMemberships: true } } },
        }),
      });
      actorContext = actor;
      if (url.pathname === "/api/v1/admin/actor-context" && request.method === "GET") { sendJson(response, 200, { actor }); return; }
    } catch (caught) {
      const error = caught as { code?: string; status?: number; message?: string };
      sendJson(response, error.status ?? 401, structuredAuthError((error.code ?? "REAUTH_REQUIRED") as never, error.message ?? "Sign in again.", correlationId)); return;
    }
  }

  if (url.pathname.startsWith("/api/v1/admin/property-identity/")) {
    if (!actorContext) { sendError(response, 401, "REAUTH_REQUIRED", "Sign in again."); return; }
    if (await handlePropertyIdentityRequest({ request, response, url, prisma, actor: actorContext })) return;
  }

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

  if (url.pathname === "/api/v1/public/client-intents" && request.method === "POST") {
    type PublicClientIntentBody = {
      tenant?: string;
      sourceOrganizationSlug?: string;
      sourceOfficeSlug?: string;
      sourceOfficeId?: string;
      sourceWebsiteId?: string;
      marketId?: string;
      preferredLanguage?: string;
      preferredCurrency?: string;
      clientName?: string;
      clientContact?: string;
      requirementText?: string;
      propertyObjectId?: string;
      notes?: string;
    };

    const body = await readJsonBody<PublicClientIntentBody>(request);
    const tenant = optionalString(body.tenant) ?? "apart4u";
    const sourceOrganizationSlug = optionalString(body.sourceOrganizationSlug) ?? organizationSlugForTenant(tenant);
    const requirementText = optionalString(body.requirementText);

    if (!requirementText) {
      sendError(response, 400, "requirement_text_required", "requirementText is required.");
      return;
    }

    const organization = await prisma.organization.findUnique({
      where: { slug: sourceOrganizationSlug },
      include: {
        offices: {
          where: optionalString(body.sourceOfficeId)
            ? { id: optionalString(body.sourceOfficeId) }
            : optionalString(body.sourceOfficeSlug)
              ? { slug: optionalString(body.sourceOfficeSlug) }
              : undefined,
          orderBy: { legalName: "asc" },
          take: 1,
        },
        siteConfigs: {
          where: { active: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    const office = organization?.offices[0];

    if (!organization || !office) {
      sendError(response, 404, "source_context_not_found", `Source organization '${sourceOrganizationSlug}' was not found.`);
      return;
    }

    const requestedMarketId = optionalString(body.marketId);
    const market = requestedMarketId
      ? await prisma.market.findUnique({ where: { id: requestedMarketId } })
      : office.defaultMarketId
        ? await prisma.market.findUnique({ where: { id: office.defaultMarketId } })
        : null;
    const language = normalizeInteractionLanguage(optionalString(body.preferredLanguage) ?? organization.defaultLanguage, organization.defaultLanguage);
    const currency = normalizeClientCurrency(optionalString(body.preferredCurrency), organization.defaultCurrency);
    const clientIntent = await prisma.clientIntent.create({
      data: {
        sourceOrganizationId: organization.id,
        sourceOfficeId: office.id,
        sourceWebsiteId: optionalString(body.sourceWebsiteId) ?? organization.siteConfigs[0]?.id ?? tenant,
        marketId: market?.id ?? null,
        preferredLanguage: language as never,
        preferredCurrency: currency as never,
        requirementText,
        status: "new",
        privateDetails: {
          create: {
            clientName: optionalString(body.clientName),
            clientContact: optionalString(body.clientContact),
            notes: optionalString(body.notes) ?? (optionalString(body.propertyObjectId) ? `Property object: ${optionalString(body.propertyObjectId)}` : undefined),
          },
        },
      },
      include: { privateDetails: true },
    });

    sendJson(response, 201, {
      ok: true,
      clientIntentId: clientIntent.id,
      status: clientIntent.status,
      tenant,
      organizationSlug: organization.slug,
      officeSlug: office.slug,
    });
    return;
  }

  if (url.pathname === "/api/v1/public/session-context" && request.method === "GET") {
    // Detect user's market context from request headers — no cookies, GDPR-compliant
    const cfCountry = request.headers["cf-ipcountry"] as string | undefined;
    const cfCity = request.headers["cf-ipcity"] as string | undefined;
    const acceptLanguage = (request.headers["accept-language"] as string | undefined) ?? "";
    const userAgent = (request.headers["user-agent"] as string | undefined) ?? "";
    const referer = (request.headers["referer"] as string | undefined) ?? "";

    const detectedCountry = cfCountry ?? "RU";
    const detectedCity = cfCity ?? null;
    const language = acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase() ?? "ru";
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
    const isHighEnd = /iphone 1[3-9]|iphone 1[0-9] pro|macbook|ipad pro/i.test(userAgent);

    // Find all active markets + their latest residential price indicator
    const period = insightPeriod();
    const [markets, indicators] = await Promise.all([
      prisma.market.findMany({ where: { active: true }, select: { id: true, slug: true, city: true, country: true } }),
      prisma.marketIndicator.findMany({
        where: { published: true, metric: marketInsightMetric, segment: "residential", period },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const priceByMarketId = new Map<string, number>();
    for (const ind of indicators as MarketIndicatorRow[]) {
      if (!priceByMarketId.has(ind.marketId) && ind.value !== null && typeof ind.value === "number") {
        priceByMarketId.set(ind.marketId, ind.value);
      }
    }

    const homeMarket = (markets as PublicMarketRow[]).find((m) => m.country === detectedCountry)
      ?? (markets as PublicMarketRow[])[0];

    // Get exchange rates (cached 24h)
    const rates = await getExchangeRates();
    const preferredCurrency = detectedCountry === "RU" ? "RUB"
      : detectedCountry === "AE" ? "AED"
      : detectedCountry === "GE" ? "GEL"
      : detectedCountry === "AM" ? "AMD"
      : detectedCountry === "US" ? "USD"
      : "USD";
    const usdToPreferred = rates[preferredCurrency] ?? 1;

    // Build session profile
    const refererHint = referer.includes("google") ? "search"
      : referer.includes("instagram") || referer.includes("facebook") ? "social"
      : referer ? "referral" : "direct";
    const segment = detectedCountry === "RU" ? "russian_investor"
      : detectedCountry === "US" ? "us_investor"
      : "international_investor";
    const intent = refererHint === "search" ? "active_search" : refererHint === "social" ? "discovery" : "direct";

    // Cross-market comparison: for each market with price data, compute sqm ratio vs home
    const homeResidentialUsd = homeMarket ? priceByMarketId.get(homeMarket.id) ?? null : null;
    const crossMarketComparisons = homeResidentialUsd
      ? (markets as PublicMarketRow[])
          .filter((m) => m.id !== homeMarket?.id && priceByMarketId.has(m.id))
          .map((m) => {
            const otherUsd = priceByMarketId.get(m.id)!;
            const ratio = Math.round((homeResidentialUsd / otherUsd) * 100) / 100;
            const pctDiff = Math.round((ratio - 1) * 100);
            return { market: { slug: m.slug, city: m.city, country: m.country }, sqmRatio: ratio, pctMoreSqm: pctDiff };
          })
          .filter((c) => c.pctMoreSqm > 0)
          .sort((a, b) => b.pctMoreSqm - a.pctMoreSqm)
          .slice(0, 4)
      : [];

    sendJson(response, 200, {
      ok: true,
      detectedCountry,
      detectedCity,
      language,
      device: isMobile ? "mobile" : "desktop",
      purchasingPower: isHighEnd ? "high" : "medium",
      refererHint,
      segment,
      intent,
      preferredCurrency,
      usdToPreferred,
      homeMarket: homeMarket ? {
        slug: homeMarket.slug,
        city: homeMarket.city,
        country: homeMarket.country,
        residentialPriceUsd: homeResidentialUsd,
      } : null,
      crossMarketComparisons,
    });
    return;
  }

  if (url.pathname === "/api/v1/public/ai-search" && request.method === "POST") {
    const body = await readJsonBody<{
      query?: string;
      tenant?: string;
      language?: string;
      sessionContext?: {
        detectedCountry?: string;
        homeMarket?: { city?: string; country?: string; residentialPriceUsd?: number | null };
        preferredCurrency?: string;
        usdToPreferred?: number;
        crossMarketComparisons?: Array<{ market: { slug: string; city: string; country: string }; sqmRatio: number }>;
      };
    }>(request);

    const query = (body.query ?? "").trim();
    const language = body.language ?? "ru";
    const sessionContext = body.sessionContext ?? {};

    if (!query) {
      sendError(response, 400, "query_required", "query is required");
      return;
    }

    // Fetch available markets + public object counts for Gemini context
    const markets = await prisma.market.findMany();
    const marketSummary = markets.map((m: { city: string; country: string }) => `${m.city} (${m.country})`).join(", ");

    // Ask Gemini to parse the query into structured filters
    const parsePrompt = [
      "Return only valid JSON, no markdown.",
      "Parse this real estate search query into structured filters.",
      `Available markets: ${marketSummary}`,
      `Available assetClass values: land, apartment, house, office, industrial_site, development_project, investment_project`,
      `User query: "${query}"`,
      'Shape: {"assetClass":string|null,"country":string|null,"city":string|null,"minArea":number|null,"maxArea":number|null,"minPrice":number|null,"maxPrice":number|null,"currency":string|null,"semanticQuery":string,"confidence":number}',
    ].join("\n");

    let filters: {
      assetClass?: string | null;
      country?: string | null;
      city?: string | null;
      minArea?: number | null;
      maxArea?: number | null;
      semanticQuery?: string;
      confidence?: number;
    } = {};

    try {
      const parsed = parseGeminiJson(await callGemini(parsePrompt));
      if (parsed && typeof parsed === "object") filters = parsed as typeof filters;
    } catch {
      // fallback: no filters, show all public objects
    }

    const aiSearchInclude = {
      market: true,
      ownerOrganization: true,
      ownerOffice: true,
      informationOwnerOrganization: true,
      informationOwnerOffice: true,
      localizations: true,
      media: { where: { public: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
    } as const;

    // Search public pool only — hard constraint
    const objects = await prisma.propertyObject.findMany({
      where: {
        status: "published",
        visibility: "public",
        canBeShownByOtherOffices: true,
        ...(filters.assetClass ? { assetClass: { equals: filters.assetClass as never } } : {}),
        ...(filters.country ? { market: { country: filters.country } } : {}),
        ...(filters.city ? { market: { city: { contains: filters.city, mode: "insensitive" as const } } } : {}),
        ...(filters.minArea ? { areaSqm: { gte: String(filters.minArea) } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      include: aiSearchInclude,
    });

    // Cross-market alternatives if few results
    let crossMarketAlternatives: typeof objects = [];
    if (objects.length < 3 && (filters.assetClass || filters.country)) {
      crossMarketAlternatives = await prisma.propertyObject.findMany({
        where: {
          status: "published",
          visibility: "public",
          canBeShownByOtherOffices: true,
          ...(filters.assetClass ? { assetClass: { equals: filters.assetClass as never } } : {}),
          ...(filters.country ? { market: { country: { not: filters.country } } } : {}),
          id: { notIn: objects.map((o: { id: string }) => o.id) },
        },
        orderBy: [{ publishedAt: "desc" }],
        take: 6,
        include: aiSearchInclude,
      });
    }

    // Generate insight text
    let insight = "";
    try {
      const homeCity = sessionContext.homeMarket?.city ?? "вашем городе";
      const homePriceUsd = sessionContext.homeMarket?.residentialPriceUsd ?? null;
      const crossComp = sessionContext.crossMarketComparisons?.[0];
      const insightPrompt = [
        "Return only valid JSON, no markdown.",
        `User searched: "${query}"`,
        `Found ${objects.length} objects in main results, ${crossMarketAlternatives.length} cross-market alternatives.`,
        homePriceUsd ? `User's home market (${homeCity}): $${Math.round(homePriceUsd)}/sqm residential.` : "",
        crossComp ? `Best cross-market ratio: ${crossComp.market.city} offers ${crossComp.sqmRatio}x more sqm for same price.` : "",
        `Language: ${language}`,
        "Write a 1-2 sentence insight that is specific, personal, and mentions concrete numbers if available.",
        'Shape: {"insight": string}',
      ].filter(Boolean).join("\n");
      const insightResult = parseGeminiJson(await callGemini(insightPrompt)) as { insight?: string } | null;
      insight = insightResult?.insight ?? "";
    } catch {
      insight = language === "ru"
        ? `Найдено ${objects.length} объектов по вашему запросу.`
        : `Found ${objects.length} objects matching your query.`;
    }

    sendJson(response, 200, {
      ok: true,
      query,
      filters,
      insight,
      objects: objects.map((o: PublicObjectRow) => serializeObject(o, language)),
      crossMarketAlternatives: crossMarketAlternatives.map((o: PublicObjectRow) => serializeObject(o, language)),
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

  if (url.pathname === "/api/v1/admin/organization/notification-settings" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const organization = await prisma.organization.findUnique({ where: { slug: organizationSlug } });

    if (!organization) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const settings = await prisma.interactionNotificationSetting.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: { organizationId: organization.id },
    });

    sendJson(response, 200, { ok: true, settings });
    return;
  }

  if (url.pathname === "/api/v1/admin/organization/notification-settings" && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const body = await readJsonBody<{
      organizationSlug?: string;
      inAdminEnabled?: boolean | string;
      telegramEnabled?: boolean | string;
      telegramChatId?: string;
      whatsappEnabled?: boolean | string;
      whatsappPhoneE164?: string;
      whatsappTemplateName?: string;
      urgentExternalEnabled?: boolean | string;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    }>(request);
    const organization = await prisma.organization.findUnique({ where: { slug: optionalString(body.organizationSlug) ?? "kvartal-moscow" } });

    if (!organization) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const settings = await prisma.interactionNotificationSetting.upsert({
      where: { organizationId: organization.id },
      update: {
        ...(body.inAdminEnabled !== undefined ? { inAdminEnabled: booleanFromBody(body.inAdminEnabled) } : {}),
        ...(body.telegramEnabled !== undefined ? { telegramEnabled: booleanFromBody(body.telegramEnabled) } : {}),
        ...(body.telegramChatId !== undefined ? { telegramChatId: optionalString(body.telegramChatId) ?? null } : {}),
        ...(body.whatsappEnabled !== undefined ? { whatsappEnabled: booleanFromBody(body.whatsappEnabled) } : {}),
        ...(body.whatsappPhoneE164 !== undefined ? { whatsappPhoneE164: optionalString(body.whatsappPhoneE164) ?? null } : {}),
        ...(body.whatsappTemplateName !== undefined ? { whatsappTemplateName: optionalString(body.whatsappTemplateName) ?? null } : {}),
        ...(body.urgentExternalEnabled !== undefined ? { urgentExternalEnabled: booleanFromBody(body.urgentExternalEnabled) } : {}),
        ...(body.quietHoursStart !== undefined ? { quietHoursStart: optionalString(body.quietHoursStart) ?? null } : {}),
        ...(body.quietHoursEnd !== undefined ? { quietHoursEnd: optionalString(body.quietHoursEnd) ?? null } : {}),
      },
      create: {
        organizationId: organization.id,
        inAdminEnabled: body.inAdminEnabled === undefined ? true : booleanFromBody(body.inAdminEnabled),
        telegramEnabled: booleanFromBody(body.telegramEnabled),
        telegramChatId: optionalString(body.telegramChatId) ?? null,
        whatsappEnabled: booleanFromBody(body.whatsappEnabled),
        whatsappPhoneE164: optionalString(body.whatsappPhoneE164) ?? null,
        whatsappTemplateName: optionalString(body.whatsappTemplateName) ?? null,
        urgentExternalEnabled: body.urgentExternalEnabled === undefined ? true : booleanFromBody(body.urgentExternalEnabled),
        quietHoursStart: optionalString(body.quietHoursStart) ?? null,
        quietHoursEnd: optionalString(body.quietHoursEnd) ?? null,
      },
    });

    sendJson(response, 200, { ok: true, settings });
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
        documents: {
          orderBy: [{ documentType: "asc" }, { updatedAt: "desc" }],
          include: {
            versions: { orderBy: { versionNumber: "desc" }, take: 5 },
          },
        },
        aiAnalyses: {
          orderBy: { analyzedAt: "desc" },
          take: 1,
          include: {
            proposals: {
              where: { status: "pending" },
              orderBy: { createdAt: "desc" },
            },
          },
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

  if (url.pathname === "/api/v1/admin/partners" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const partners = await prisma.organization.findMany({
      where: {
        id: { not: context.organization.id },
        status: { in: ["active", "draft"] },
      },
      orderBy: { legalName: "asc" },
      include: {
        offices: { orderBy: { legalName: "asc" }, take: 1 },
        partnerMetrics: true,
        _count: {
          select: {
            propertyObjects: {
              where: { status: "published", visibility: "public", canBeShownByOtherOffices: true },
            },
          },
        },
      },
    });

    const activeInteractions = await prisma.partnerInteraction.groupBy({
      by: ["targetOrganizationId"],
      where: {
        initiatingOrganizationId: context.organization.id,
        status: { notIn: ["archived", "completed"] },
      },
      _count: { _all: true },
    });
    const incomingInteractions = await prisma.partnerInteraction.groupBy({
      by: ["initiatingOrganizationId"],
      where: {
        targetOrganizationId: context.organization.id,
        status: { notIn: ["archived", "completed"] },
      },
      _count: { _all: true },
    });
    const activeByOrganization = new Map<string, number>();
    for (const item of activeInteractions) {
      activeByOrganization.set(item.targetOrganizationId, (activeByOrganization.get(item.targetOrganizationId) ?? 0) + item._count._all);
    }
    for (const item of incomingInteractions) {
      activeByOrganization.set(item.initiatingOrganizationId, (activeByOrganization.get(item.initiatingOrganizationId) ?? 0) + item._count._all);
    }

    const unreadMessages = await prisma.interactionMessage.groupBy({
      by: ["senderOrganizationId"],
      where: {
        readAt: null,
        deletedAt: null,
        senderOrganizationId: { not: context.organization.id },
        interaction: {
          OR: [
            { initiatingOrganizationId: context.organization.id },
            { targetOrganizationId: context.organization.id },
          ],
        },
      },
      _count: { _all: true },
    });
    const unreadByOrganization = new Map(unreadMessages.map((item) => [item.senderOrganizationId, item._count._all]));

    sendJson(response, 200, {
      ok: true,
      partners: partners.map((partner) => {
        const metric = partner.partnerMetrics[0];
        const office = partner.offices[0];

        return {
          id: partner.id,
          slug: partner.slug,
          legalName: partner.legalName,
          defaultLanguage: partner.defaultLanguage,
          status: partner.status,
          primaryOffice: office ? { id: office.id, slug: office.slug, legalName: office.legalName, city: office.city, country: office.country } : null,
          sharedObjectCount: partner._count.propertyObjects,
          activeInteractionCount: activeByOrganization.get(partner.id) ?? 0,
          unreadMessageCount: unreadByOrganization.get(partner.id) ?? 0,
          metrics: {
            averageFirstResponseSec: metric?.averageFirstResponseSec ?? null,
            completedDealsCount: metric?.completedDealsCount ?? 0,
            acceptanceRatePercent: decimalToString(metric?.acceptanceRatePercent),
            rating: decimalToString(metric?.rating),
          },
        };
      }),
    });
    return;
  }

  const partnerObjectsMatch = url.pathname.match(/^\/api\/v1\/admin\/partners\/([^/]+)\/objects$/);

  if (partnerObjectsMatch && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const language = url.searchParams.get("language") ?? "ru";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const partnerKey = decodeURIComponent(partnerObjectsMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const partner = await prisma.organization.findFirst({
      where: { OR: [{ id: partnerKey }, { slug: partnerKey }] },
    });

    if (!partner || partner.id === context.organization.id) {
      sendError(response, 404, "partner_not_found", "Partner was not found.");
      return;
    }

    const objects = await prisma.propertyObject.findMany({
      where: {
        ownerOrganizationId: partner.id,
        status: "published",
        visibility: "public",
        canBeShownByOtherOffices: true,
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: Math.min(Number(url.searchParams.get("limit") ?? 50), 100),
      include: {
        market: true,
        ownerOrganization: true,
        ownerOffice: true,
        informationOwnerOrganization: true,
        informationOwnerOffice: true,
        localizations: true,
        media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 3 },
      },
    });

    sendJson(response, 200, {
      ok: true,
      partner: { id: partner.id, slug: partner.slug, legalName: partner.legalName, defaultLanguage: partner.defaultLanguage },
      objects: objects.map((object) => serializeObject(object as PublicObjectRow, language, "admin")),
    });
    return;
  }

  const attachmentDownloadMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/attachments\/([^/]+)$/);

  if (attachmentDownloadMatch && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const attachmentId = decodeURIComponent(attachmentDownloadMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const attachment = await prisma.interactionAttachment.findUnique({
      where: { id: attachmentId },
      include: { interaction: true },
    });

    if (!attachment || attachment.deletedAt || !canAccessInteraction(attachment.interaction, context)) {
      sendError(response, 404, "attachment_not_found", "Attachment was not found.");
      return;
    }

    if (attachment.scanStatus !== "clean") {
      sendError(response, 423, "attachment_not_clean", "Attachment is not available until security scanning marks it clean.");
      return;
    }

    const file = storageBucket.file(attachment.storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      sendError(response, 404, "attachment_file_not_found", "Attachment file was not found in Cloud Storage.");
      return;
    }

    const [metadata] = await file.getMetadata();
    streamStorageFile(response, attachment.storagePath, metadata, "private, max-age=300");
    return;
  }

  const partnerDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/partners\/([^/]+)$/);

  if (partnerDetailMatch && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const partnerKey = decodeURIComponent(partnerDetailMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const partner = await prisma.organization.findFirst({
      where: { OR: [{ id: partnerKey }, { slug: partnerKey }] },
      include: {
        offices: { orderBy: { legalName: "asc" } },
        partnerMetrics: true,
        _count: {
          select: {
            propertyObjects: {
              where: { status: "published", visibility: "public", canBeShownByOtherOffices: true },
            },
          },
        },
      },
    });

    if (!partner || partner.id === context.organization.id) {
      sendError(response, 404, "partner_not_found", "Partner was not found.");
      return;
    }

    sendJson(response, 200, {
      ok: true,
      partner: {
        id: partner.id,
        slug: partner.slug,
        legalName: partner.legalName,
        defaultLanguage: partner.defaultLanguage,
        defaultCurrency: partner.defaultCurrency,
        offices: partner.offices.map((office) => ({ id: office.id, slug: office.slug, legalName: office.legalName, city: office.city, country: office.country })),
        sharedObjectCount: partner._count.propertyObjects,
        metrics: partner.partnerMetrics,
      },
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/interactions" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const language = url.searchParams.get("language") ?? "ru";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const interactions = await prisma.partnerInteraction.findMany({
      where: {
        OR: [
          { initiatingOrganizationId: context.organization.id },
          { targetOrganizationId: context.organization.id },
        ],
        ...(url.searchParams.get("includeArchived") === "true" ? {} : { status: { not: "archived" as const } }),
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(Number(url.searchParams.get("limit") ?? 50), 100),
      include: {
        initiatingOrganization: true,
        initiatingOffice: true,
        targetOrganization: true,
        targetOffice: true,
        propertyObject: {
          include: {
            market: true,
            ownerOrganization: true,
            ownerOffice: true,
            informationOwnerOrganization: true,
            informationOwnerOffice: true,
            localizations: true,
            media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { senderOrganization: true, senderOffice: true },
        },
        attachments: { orderBy: { createdAt: "desc" } },
        reviews: {
          where: { hiddenByPlatform: false },
          include: { reviewerOrganization: true, reviewedOrganization: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    sendJson(response, 200, {
      ok: true,
      interactions: interactions
        .filter((interaction) => canAccessInteraction(interaction, context))
        .map((interaction) => serializePartnerInteraction(interaction as never, context.organization.id, language)),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/interactions/search" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const language = url.searchParams.get("language") ?? "ru";
    const query = optionalString(url.searchParams.get("query") ?? url.searchParams.get("q") ?? "");
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    if (!query || query.length < 2) {
      sendJson(response, 200, { ok: true, interactions: [] });
      return;
    }

    const interactions = await prisma.partnerInteraction.findMany({
      where: {
        OR: [
          { initiatingOrganizationId: context.organization.id },
          { targetOrganizationId: context.organization.id },
        ],
        ...(url.searchParams.get("includeArchived") === "true" ? {} : { status: { not: "archived" as const } }),
        AND: [
          {
            OR: [
              { subject: { contains: query, mode: "insensitive" } },
              { initialMessage: { contains: query, mode: "insensitive" } },
              { initiatingOrganization: { legalName: { contains: query, mode: "insensitive" } } },
              { targetOrganization: { legalName: { contains: query, mode: "insensitive" } } },
              { messages: { some: { deletedAt: null, originalText: { contains: query, mode: "insensitive" } } } },
              {
                propertyObject: {
                  localizations: {
                    some: {
                      OR: [
                        { title: { contains: query, mode: "insensitive" } },
                        { addressDisplay: { contains: query, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(Number(url.searchParams.get("limit") ?? 50), 100),
      include: {
        initiatingOrganization: true,
        initiatingOffice: true,
        targetOrganization: true,
        targetOffice: true,
        propertyObject: {
          include: {
            market: true,
            ownerOrganization: true,
            ownerOffice: true,
            informationOwnerOrganization: true,
            informationOwnerOffice: true,
            localizations: true,
            media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { senderOrganization: true, senderOffice: true },
        },
        attachments: { orderBy: { createdAt: "desc" } },
        reviews: {
          where: { hiddenByPlatform: false },
          include: { reviewerOrganization: true, reviewedOrganization: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    sendJson(response, 200, {
      ok: true,
      query,
      interactions: interactions
        .filter((interaction) => canAccessInteraction(interaction, context))
        .map((interaction) => serializePartnerInteraction(interaction as never, context.organization.id, language)),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/interactions/notifications" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const notifications = await prisma.interactionNotification.findMany({
      where: {
        recipientOrganizationId: context.organization.id,
        recipientOfficeId: context.office.id,
        channel: "in_admin",
        ...(url.searchParams.get("includeRead") === "true" ? {} : { readAt: null }),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(url.searchParams.get("limit") ?? 30), 100),
    });

    const unreadCount = await prisma.interactionNotification.count({
      where: {
        recipientOrganizationId: context.organization.id,
        recipientOfficeId: context.office.id,
        channel: "in_admin",
        readAt: null,
      },
    });

    sendJson(response, 200, {
      ok: true,
      unreadCount,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        interactionId: notification.interactionId,
        messageId: notification.messageId,
        eventType: notification.eventType,
        title: notification.title,
        body: notification.body,
        status: notification.status,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
      })),
    });
    return;
  }

  const notificationReadMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/notifications\/([^/]+)\/read$/);

  if (notificationReadMatch && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const body = await readJsonBody<{ organizationSlug?: string; officeSlug?: string }>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const notificationId = decodeURIComponent(notificationReadMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const updated = await prisma.interactionNotification.updateMany({
      where: {
        id: notificationId,
        recipientOrganizationId: context.organization.id,
        recipientOfficeId: context.office.id,
        channel: "in_admin",
      },
      data: { readAt: new Date(), status: "read" },
    });

    if (!updated.count) {
      sendError(response, 404, "notification_not_found", "Notification was not found.");
      return;
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/v1/admin/interactions/notifications/dispatch" && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const due = await prisma.interactionNotification.findMany({
      where: {
        channel: { in: ["telegram", "whatsapp"] },
        status: { in: ["pending", "failed"] },
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: new Date() } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    for (const notification of due) {
      await deliverInteractionNotification(notification);
    }

    sendJson(response, 200, { ok: true, dispatched: due.length });
    return;
  }

  if (url.pathname === "/api/v1/admin/interactions" && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      targetOrganizationId?: string;
      targetOfficeId?: string;
      propertyObjectId?: string;
      type?: string;
      priority?: string;
      subject?: string;
      message?: string;
      originalLanguage?: string;
      conversationLanguage?: string;
      actorEmail?: string;
      actorName?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const propertyObjectId = optionalString(body.propertyObjectId);
    const targetOrganizationId = optionalString(body.targetOrganizationId);
    const targetOfficeId = optionalString(body.targetOfficeId);
    const message = optionalString(body.message);

    if (!context || !propertyObjectId || !targetOrganizationId || !targetOfficeId || !message) {
      sendError(response, 400, "required_fields_missing", "organization, target partner, object, and message are required.");
      return;
    }

    if (message.length > 5000) {
      sendError(response, 400, "message_too_long", "Message must be 5000 characters or less.");
      return;
    }

    const conversationLanguage = normalizeInteractionLanguage(optionalString(body.conversationLanguage) ?? context.organization.defaultLanguage, context.organization.defaultLanguage);
    const originalLanguage = normalizeInteractionLanguage(optionalString(body.originalLanguage) ?? conversationLanguage, conversationLanguage);
    let translation: Awaited<ReturnType<typeof translateInteractionText>>;

    try {
      translation = await translateInteractionText(message, originalLanguage, conversationLanguage);
    } catch {
      translation = {
        translatedText: null,
        translatedLanguage: conversationLanguage,
        translationStatus: "failed",
        provider: null,
      };
    }

    const [propertyObject, blocked, actor] = await Promise.all([
      prisma.propertyObject.findFirst({
        where: {
          id: propertyObjectId,
          ownerOrganizationId: targetOrganizationId,
          ownerOfficeId: targetOfficeId,
          status: "published",
          visibility: "public",
          canBeShownByOtherOffices: true,
        },
      }),
      prisma.blockedPartner.findFirst({
        where: {
          OR: [
            {
              organizationId: targetOrganizationId,
              blockedPartnerOrganizationId: context.organization.id,
            },
            {
              organizationId: context.organization.id,
              blockedPartnerOrganizationId: targetOrganizationId,
            },
          ],
        },
      }),
      upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName)),
    ]);

    if (!propertyObject) {
      sendError(response, 404, "public_object_not_found", "Object is not available in the shared public inventory for this partner.");
      return;
    }

    if (blocked) {
      sendError(response, 403, "partner_unavailable", "Partner is unavailable for new requests.");
      return;
    }

    const interaction = await prisma.$transaction(async (tx) => {
      const created = await tx.partnerInteraction.create({
        data: {
          initiatingOrganizationId: context.organization.id,
          initiatingOfficeId: context.office.id,
          targetOrganizationId,
          targetOfficeId,
          propertyObjectId,
          createdByUserId: actor.id,
          type: (["info_request", "commercial", "cooperation"].includes(optionalString(body.type) ?? "") ? body.type : "info_request") as never,
          priority: (["normal", "urgent", "critical"].includes(optionalString(body.priority) ?? "") ? body.priority : "normal") as never,
          conversationLanguage: conversationLanguage as never,
          subject: optionalString(body.subject),
          initialMessage: message,
          messages: {
            create: {
              senderUserId: actor.id,
              senderOrganizationId: context.organization.id,
              senderOfficeId: context.office.id,
              originalText: message,
              originalLanguage: originalLanguage as never,
              translatedText: translation.translatedText,
              translatedLanguage: translation.translatedLanguage as never,
              translationStatus: translation.translationStatus,
              deliveryStatus: "delivered",
            },
          },
          events: {
            create: [
              {
                eventType: "created",
                actorUserId: actor.id,
                actorOrganizationId: context.organization.id,
                actorOfficeId: context.office.id,
                payload: { priority: optionalString(body.priority) ?? "normal", type: optionalString(body.type) ?? "info_request" },
              },
              {
                eventType: "message_sent",
                actorUserId: actor.id,
                actorOrganizationId: context.organization.id,
                actorOfficeId: context.office.id,
                payload: { initial: true },
              },
            ],
          },
        },
        include: {
          initiatingOrganization: true,
          initiatingOffice: true,
          targetOrganization: true,
          targetOffice: true,
          propertyObject: {
            include: {
              market: true,
              ownerOrganization: true,
              ownerOffice: true,
              informationOwnerOrganization: true,
              informationOwnerOffice: true,
              localizations: true,
              media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
          messages: { include: { senderOrganization: true, senderOffice: true }, orderBy: { createdAt: "asc" } },
          attachments: { orderBy: { createdAt: "asc" } },
          reviews: {
            where: { hiddenByPlatform: false },
            include: { reviewerOrganization: true, reviewedOrganization: true },
            orderBy: { createdAt: "desc" },
          },
          events: { orderBy: { createdAt: "asc" } },
        },
      });

      return created;
    });

    sendJson(response, 201, {
      ok: true,
      interaction: serializePartnerInteraction(interaction as never, context.organization.id, interaction.conversationLanguage),
    });
    queueInteractionNotifications({
      interactionId: interaction.id,
      messageId: interaction.messages[0]?.id ?? null,
      recipientOrganizationId: targetOrganizationId,
      recipientOfficeId: targetOfficeId,
      eventType: "new_interaction",
      title: "New partner interaction",
      body: `${context.organization.legalName}: ${optionalString(body.subject) ?? message.slice(0, 120)}`,
      priority: interaction.priority,
    });
    return;
  }

  const interactionMessagesMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/messages$/);

  if (interactionMessagesMatch && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const interactionId = decodeURIComponent(interactionMessagesMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const messages = await prisma.interactionMessage.findMany({
      where: { interactionId },
      orderBy: { createdAt: "asc" },
      take: Math.min(Number(url.searchParams.get("limit") ?? 50), 100),
      include: { senderOrganization: true, senderOffice: true },
    });

    sendJson(response, 200, {
      ok: true,
      messages: messages.map((message) => serializeInteractionMessage(message, context.organization.id)),
    });
    return;
  }

  if (interactionMessagesMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      message?: string;
      originalLanguage?: string;
      actorEmail?: string;
      actorName?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(interactionMessagesMatch[1]);
    const message = optionalString(body.message);

    if (!context || !message) {
      sendError(response, 400, "required_fields_missing", "Message is required.");
      return;
    }

    if (message.length > 5000) {
      sendError(response, 400, "message_too_long", "Message must be 5000 characters or less.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const isTargetResponse = interaction.targetOrganizationId === context.organization.id && !interaction.firstTargetResponseAt;
    const originalLanguage = normalizeInteractionLanguage(optionalString(body.originalLanguage) ?? interaction.conversationLanguage, interaction.conversationLanguage);
    const targetLanguage = normalizeInteractionLanguage(interaction.conversationLanguage);
    let translation: Awaited<ReturnType<typeof translateInteractionText>>;

    try {
      translation = await translateInteractionText(message, originalLanguage, targetLanguage);
    } catch {
      translation = {
        translatedText: null,
        translatedLanguage: targetLanguage,
        translationStatus: "failed",
        provider: null,
      };
    }

    const created = await prisma.$transaction(async (tx) => {
      const newMessage = await tx.interactionMessage.create({
        data: {
          interactionId,
          senderUserId: actor.id,
          senderOrganizationId: context.organization.id,
          senderOfficeId: context.office.id,
          originalText: message,
          originalLanguage: originalLanguage as never,
          translatedText: translation.translatedText,
          translatedLanguage: translation.translatedLanguage as never,
          translationStatus: translation.translationStatus,
          deliveryStatus: "delivered",
        },
        include: { senderOrganization: true, senderOffice: true },
      });

      await tx.partnerInteraction.update({
        where: { id: interactionId },
        data: {
          updatedAt: new Date(),
          ...(isTargetResponse ? { firstTargetResponseAt: new Date(), status: "information_received" as never } : {}),
        },
      });

      await tx.interactionEvent.create({
        data: {
          interactionId,
          eventType: "message_sent",
          actorUserId: actor.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { messageId: newMessage.id },
        },
      });

      return newMessage;
    });

    sendJson(response, 201, {
      ok: true,
      message: serializeInteractionMessage(created, context.organization.id),
    });
    queueInteractionNotifications({
      interactionId,
      messageId: created.id,
      recipientOrganizationId: interaction.initiatingOrganizationId === context.organization.id ? interaction.targetOrganizationId : interaction.initiatingOrganizationId,
      recipientOfficeId: interaction.initiatingOrganizationId === context.organization.id ? interaction.targetOfficeId : interaction.initiatingOfficeId,
      eventType: "new_message",
      title: "New partner message",
      body: message.slice(0, 500),
      priority: interaction.priority,
    });
    return;
  }

  const attachmentUploadPolicyMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/attachments\/upload-policy$/);

  if (attachmentUploadPolicyMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      originalFileName?: string;
      mimeType?: string;
      sizeBytes?: number;
      uploadedByEmail?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(attachmentUploadPolicyMatch[1]);
    const originalFileName = optionalString(body.originalFileName) ?? "attachment";
    const mimeType = optionalString(body.mimeType) ?? "application/octet-stream";
    const requestedSizeBytes = Number(body.sizeBytes ?? 0);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    if (!allowedInteractionAttachmentMimeTypes.has(mimeType) || !hasAllowedInteractionAttachmentExtension(originalFileName, mimeType)) {
      sendError(response, 400, "unsupported_attachment_type", `MIME type '${mimeType}' is not allowed for interaction attachments.`);
      return;
    }

    if (requestedSizeBytes > maxInteractionAttachmentBytes) {
      sendError(response, 400, "attachment_too_large", "Attachment exceeds the 25 MB per-file limit.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({
      where: { id: interactionId },
      include: { attachments: true },
    });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const activeAttachments = interaction.attachments.filter((attachment) => !attachment.deletedAt);
    const totalBytes = activeAttachments.reduce((sum, attachment) => sum + Number(attachment.sizeBytes), 0);

    if (activeAttachments.length >= maxInteractionAttachmentCount) {
      sendError(response, 400, "attachment_count_limit", "Interaction attachment count limit reached.");
      return;
    }

    if (totalBytes + requestedSizeBytes > maxInteractionAttachmentTotalBytes) {
      sendError(response, 400, "attachment_total_limit", "Interaction attachment total size limit reached.");
      return;
    }

    const attachmentId = randomUUID();
    const extension = extensionForFileName(originalFileName, mimeType);
    const storagePath = [
      "organizations",
      context.organization.id,
      "offices",
      context.office.id,
      "interactions",
      interactionId,
      "attachments",
      attachmentId,
      `original.${extension}`,
    ].join("/");
    const [policy] = await storageBucket.file(storagePath).generateSignedPostPolicyV4({
      expires: Date.now() + 15 * 60 * 1000,
      conditions: [
        ["eq", "$Content-Type", mimeType],
        ["content-length-range", 0, maxInteractionAttachmentBytes],
      ],
      fields: {
        "Content-Type": mimeType,
      },
    });

    sendJson(response, 200, {
      ok: true,
      upload: {
        attachmentId,
        storagePath,
        url: policy.url,
        fields: policy.fields,
        method: "POST",
        maxBytes: maxInteractionAttachmentBytes,
      },
    });
    return;
  }

  const interactionReminderMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/reminder$/);

  if (interactionReminderMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      actorEmail?: string;
      actorName?: string;
      message?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(interactionReminderMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    if (interaction.status === "archived" || interaction.status === "completed") {
      sendError(response, 400, "interaction_closed", "Closed interactions cannot receive reminders.");
      return;
    }

    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.partnerInteraction.update({
        where: { id: interactionId },
        data: { remindedAt: now },
        include: {
          initiatingOrganization: true,
          initiatingOffice: true,
          targetOrganization: true,
          targetOffice: true,
          propertyObject: {
            include: {
              market: true,
              ownerOrganization: true,
              ownerOffice: true,
              informationOwnerOrganization: true,
              informationOwnerOffice: true,
              localizations: true,
              media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
          messages: { orderBy: { createdAt: "asc" }, include: { senderOrganization: true, senderOffice: true } },
          attachments: { orderBy: { createdAt: "asc" } },
          events: { orderBy: { createdAt: "asc" } },
        },
      });

      await tx.interactionEvent.create({
        data: {
          interactionId,
          eventType: "reminder_sent",
          actorUserId: actor.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { message: optionalString(body.message) ?? null },
        },
      });

      return result;
    });

    sendJson(response, 200, {
      ok: true,
      interaction: serializePartnerInteraction(updated as never, context.organization.id, updated.conversationLanguage),
    });
    queueInteractionNotifications({
      interactionId,
      recipientOrganizationId: interaction.initiatingOrganizationId === context.organization.id ? interaction.targetOrganizationId : interaction.initiatingOrganizationId,
      recipientOfficeId: interaction.initiatingOrganizationId === context.organization.id ? interaction.targetOfficeId : interaction.initiatingOfficeId,
      eventType: "reminder",
      title: "Partner interaction reminder",
      body: optionalString(body.message) ?? `Reminder for interaction ${interactionId}`,
      priority: interaction.priority,
    });
    return;
  }

  const interactionReviewMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/reviews$/);

  if (interactionReviewMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      actorEmail?: string;
      actorName?: string;
      rating?: number | string;
      text?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(interactionReviewMatch[1]);
    const rating = Number(body.rating);
    const text = optionalString(body.text);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      sendError(response, 400, "invalid_rating", "Rating must be an integer from 1 to 5.");
      return;
    }

    if (text && text.length > 500) {
      sendError(response, 400, "review_too_long", "Review text must be 500 characters or less.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({
      where: { id: interactionId },
      include: {
        reviews: true,
      },
    });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    if (interaction.status !== "completed") {
      sendError(response, 400, "interaction_not_completed", "Reviews can be submitted only after interaction completion.");
      return;
    }

    const completedWindowMs = 30 * 24 * 60 * 60 * 1000;

    const completedAt = interaction.completedAt ?? interaction.updatedAt;

    if (Date.now() - completedAt.getTime() > completedWindowMs) {
      sendError(response, 400, "review_window_closed", "Review window is closed.");
      return;
    }

    const reviewingInitiator = interaction.initiatingOrganizationId === context.organization.id;
    const reviewedOrganizationId = reviewingInitiator ? interaction.targetOrganizationId : interaction.initiatingOrganizationId;
    const reviewedOfficeId = reviewingInitiator ? interaction.targetOfficeId : interaction.initiatingOfficeId;
    const existingReview = interaction.reviews.find(
      (review) => review.reviewerOrganizationId === context.organization.id && review.reviewedOrganizationId === reviewedOrganizationId,
    );

    if (existingReview && Date.now() - existingReview.createdAt.getTime() > 24 * 60 * 60 * 1000) {
      sendError(response, 400, "review_edit_window_closed", "Review edit window is closed.");
      return;
    }

    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const review = await prisma.$transaction(async (tx) => {
      const saved = existingReview
        ? await tx.partnerReview.update({
            where: { id: existingReview.id },
            data: { rating, text: text || null },
            include: { reviewerOrganization: true, reviewedOrganization: true },
          })
        : await tx.partnerReview.create({
            data: {
              interactionId,
              reviewerUserId: actor.id,
              reviewerOrganizationId: context.organization.id,
              reviewerOfficeId: context.office.id,
              reviewedOrganizationId,
              reviewedOfficeId,
              rating,
              text: text || null,
            },
            include: { reviewerOrganization: true, reviewedOrganization: true },
          });

      await tx.interactionEvent.create({
        data: {
          interactionId,
          eventType: existingReview ? "review_updated" : "review_created",
          actorUserId: actor.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { rating, reviewedOrganizationId },
        },
      });

      const aggregate = await tx.partnerReview.aggregate({
        where: { reviewedOrganizationId, hiddenByPlatform: false },
        _avg: { rating: true },
      });

      const existingMetric = await tx.partnerMetric.findFirst({
        where: { organizationId: reviewedOrganizationId, officeId: null },
      });

      if (existingMetric) {
        await tx.partnerMetric.update({
          where: { id: existingMetric.id },
          data: { rating: aggregate._avg.rating ?? null, lastUpdatedAt: new Date() },
        });
      } else {
        await tx.partnerMetric.create({
          data: {
            organizationId: reviewedOrganizationId,
            officeId: null,
            rating: aggregate._avg.rating ?? null,
            lastUpdatedAt: new Date(),
          },
        });
      }

      return saved;
    });

    sendJson(response, 200, {
      ok: true,
      review: {
        id: review.id,
        reviewer: {
          organizationSlug: review.reviewerOrganization.slug,
          organizationName: review.reviewerOrganization.legalName,
          ownOrganization: true,
        },
        reviewed: {
          organizationSlug: review.reviewedOrganization.slug,
          organizationName: review.reviewedOrganization.legalName,
        },
        rating: review.rating,
        text: review.text,
        hiddenByPlatform: review.hiddenByPlatform,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
      },
    });
    return;
  }

  const interactionDealRoomMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/deal-room$/);

  if (interactionDealRoomMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      actorEmail?: string;
      actorName?: string;
      note?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(interactionDealRoomMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({
      where: { id: interactionId },
      include: {
        propertyObject: {
          include: {
            localizations: true,
            ownerOrganization: true,
            ownerOffice: true,
          },
        },
      },
    });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    if (interaction.dealRoomId) {
      sendJson(response, 200, { ok: true, dealRoom: { id: interaction.dealRoomId }, alreadyLinked: true });
      return;
    }

    if (interaction.status === "archived") {
      sendError(response, 400, "interaction_archived", "Archived interactions cannot open deal rooms.");
      return;
    }

    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const localization =
      interaction.propertyObject.localizations.find((item) => item.language === interaction.conversationLanguage) ??
      interaction.propertyObject.localizations.find((item) => item.language === "ru") ??
      interaction.propertyObject.localizations[0];
    const requirementText = [
      interaction.subject ?? `Deal room from partner interaction ${interaction.id}`,
      localization?.title ? `Object: ${localization.title}` : null,
      interaction.initialMessage ? `Initial message: ${interaction.initialMessage}` : null,
      optionalString(body.note) ? `Note: ${optionalString(body.note)}` : null,
    ].filter(Boolean).join("\n\n");

    const result = await prisma.$transaction(async (tx) => {
      const clientIntent = await tx.clientIntent.create({
        data: {
          sourceOrganizationId: interaction.initiatingOrganizationId,
          sourceOfficeId: interaction.initiatingOfficeId,
          marketId: interaction.propertyObject.marketId,
          preferredLanguage: interaction.conversationLanguage,
          preferredCurrency: context.organization.defaultCurrency as never,
          requirementText,
          status: "in_deal_room",
        },
      });
      const dealRoom = await tx.dealRoom.create({
        data: {
          clientIntentId: clientIntent.id,
          sellerOrganizationId: interaction.targetOrganizationId,
          sellerOfficeId: interaction.targetOfficeId,
          buyerOrganizationId: interaction.initiatingOrganizationId,
          buyerOfficeId: interaction.initiatingOfficeId,
          status: "draft",
          objects: {
            create: {
              propertyObjectId: interaction.propertyObjectId,
            },
          },
          events: {
            create: {
              eventType: "created_from_partner_interaction",
              authorOrganizationId: context.organization.id,
              authorOfficeId: context.office.id,
              payload: {
                interactionId,
                propertyObjectId: interaction.propertyObjectId,
              },
            },
          },
        },
      });

      await tx.partnerInteraction.update({
        where: { id: interactionId },
        data: { dealRoomId: dealRoom.id, status: "in_deal" },
      });

      await tx.interactionEvent.create({
        data: {
          interactionId,
          eventType: "deal_room_opened",
          actorUserId: actor.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { dealRoomId: dealRoom.id, clientIntentId: clientIntent.id },
        },
      });

      return { dealRoom, clientIntent };
    });

    sendJson(response, 201, {
      ok: true,
      dealRoom: {
        id: result.dealRoom.id,
        clientIntentId: result.clientIntent.id,
        status: result.dealRoom.status,
      },
    });
    return;
  }

  const interactionExportPdfMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/export-pdf$/);

  if (interactionExportPdfMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      language?: string;
      actorEmail?: string;
      actorName?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(interactionExportPdfMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({
      where: { id: interactionId },
      include: {
        initiatingOrganization: true,
        initiatingOffice: true,
        targetOrganization: true,
        targetOffice: true,
        propertyObject: {
          include: {
            market: true,
            ownerOrganization: true,
            ownerOffice: true,
            informationOwnerOrganization: true,
            informationOwnerOffice: true,
            localizations: true,
            media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
        messages: { orderBy: { createdAt: "asc" }, include: { senderOrganization: true, senderOffice: true } },
        attachments: { orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const pdfBuffer = await generateInteractionPdfBuffer(
      interaction as never,
      context.organization.id,
      normalizeInteractionLanguage(optionalString(body.language) ?? interaction.conversationLanguage, interaction.conversationLanguage),
    );
    const exportResult = await saveInteractionPdf(interactionId, pdfBuffer);

    await prisma.interactionEvent.create({
      data: {
        interactionId,
        eventType: "pdf_exported",
        actorUserId: actor.id,
        actorOrganizationId: context.organization.id,
        actorOfficeId: context.office.id,
        payload: {
          storagePath: exportResult.storagePath,
          sizeBytes: pdfBuffer.length,
        },
      },
    });

    sendJson(response, 201, {
      ok: true,
      export: {
        storagePath: exportResult.storagePath,
        url: exportResult.signedUrl,
        expiresInSec: 900,
        sizeBytes: pdfBuffer.length,
      },
    });
    return;
  }

  const interactionEscalationMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/escalate$/);

  if (interactionEscalationMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      actorEmail?: string;
      actorName?: string;
      reason?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(interactionEscalationMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    if (interaction.status === "archived" || interaction.status === "completed") {
      sendError(response, 400, "interaction_closed", "Closed interactions cannot be escalated.");
      return;
    }

    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.partnerInteraction.update({
        where: { id: interactionId },
        data: { escalatedAt: now },
        include: {
          initiatingOrganization: true,
          initiatingOffice: true,
          targetOrganization: true,
          targetOffice: true,
          propertyObject: {
            include: {
              market: true,
              ownerOrganization: true,
              ownerOffice: true,
              informationOwnerOrganization: true,
              informationOwnerOffice: true,
              localizations: true,
              media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
          messages: { orderBy: { createdAt: "asc" }, include: { senderOrganization: true, senderOffice: true } },
          attachments: { orderBy: { createdAt: "asc" } },
          events: { orderBy: { createdAt: "asc" } },
        },
      });

      await tx.interactionEvent.create({
        data: {
          interactionId,
          eventType: "support_escalated",
          actorUserId: actor.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { reason: optionalString(body.reason) ?? null },
        },
      });

      return result;
    });

    sendJson(response, 200, {
      ok: true,
      interaction: serializePartnerInteraction(updated as never, context.organization.id, updated.conversationLanguage),
    });
    queueInteractionNotifications({
      interactionId,
      recipientOrganizationId: interaction.initiatingOrganizationId === context.organization.id ? interaction.targetOrganizationId : interaction.initiatingOrganizationId,
      recipientOfficeId: interaction.initiatingOrganizationId === context.organization.id ? interaction.targetOfficeId : interaction.initiatingOfficeId,
      eventType: "escalation",
      title: "Partner interaction escalated",
      body: optionalString(body.reason) ?? `Interaction ${interactionId} was escalated.`,
      priority: "critical",
    });
    return;
  }

  const attachmentConfirmMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/attachments\/confirm$/);

  if (attachmentConfirmMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      attachmentId?: string;
      storagePath?: string;
      originalFileName?: string;
      uploadedByEmail?: string;
      uploadedByName?: string;
      messageId?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(attachmentConfirmMatch[1]);
    const attachmentId = optionalString(body.attachmentId);
    const storagePath = optionalString(body.storagePath);

    if (!context || !attachmentId || !storagePath) {
      sendError(response, 400, "required_fields_missing", "organization, attachmentId, and storagePath are required.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({
      where: { id: interactionId },
      include: { attachments: true },
    });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const expectedPrefix = [
      "organizations",
      context.organization.id,
      "offices",
      context.office.id,
      "interactions",
      interactionId,
      "attachments",
      attachmentId,
    ].join("/");

    if (!storagePath.startsWith(`${expectedPrefix}/`)) {
      sendError(response, 400, "invalid_storage_path", "The uploaded attachment path does not belong to this interaction.");
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
    const originalFileName = optionalString(body.originalFileName) ?? "attachment";

    if (!allowedInteractionAttachmentMimeTypes.has(mimeType) || !hasAllowedInteractionAttachmentExtension(originalFileName, mimeType) || sizeBytes > maxInteractionAttachmentBytes) {
      await file.delete({ ignoreNotFound: true });
      sendError(response, 400, "invalid_uploaded_attachment", "Uploaded file type or size is not allowed.");
      return;
    }

    const filePrefix = await readStorageFilePrefix(storagePath);

    if (!hasAllowedInteractionAttachmentSignature(filePrefix, mimeType)) {
      await file.delete({ ignoreNotFound: true });
      sendError(response, 400, "invalid_uploaded_attachment_signature", "Uploaded file content signature does not match the declared attachment type.");
      return;
    }

    const activeAttachments = interaction.attachments.filter((attachment) => !attachment.deletedAt);
    const totalBytes = activeAttachments.reduce((sum, attachment) => sum + Number(attachment.sizeBytes), 0);

    if (activeAttachments.length >= maxInteractionAttachmentCount || totalBytes + sizeBytes > maxInteractionAttachmentTotalBytes) {
      await file.delete({ ignoreNotFound: true });
      sendError(response, 400, "attachment_limit_reached", "Interaction attachment limits would be exceeded.");
      return;
    }

    const uploadedByUser = await upsertInteractionActor(optionalString(body.uploadedByEmail), optionalString(body.uploadedByName));
    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.interactionAttachment.create({
        data: {
          id: attachmentId,
          interactionId,
          messageId: optionalString(body.messageId) || null,
          ownerOrganizationId: context.organization.id,
          ownerOfficeId: context.office.id,
          uploadedByUserId: uploadedByUser.id,
          storagePath,
          originalFileName,
          mimeType,
          sizeBytes: BigInt(sizeBytes),
          scanStatus: "scan_pending",
        },
      });

      await tx.interactionEvent.create({
        data: {
          interactionId,
          eventType: "attachment_uploaded",
          actorUserId: uploadedByUser.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { attachmentId: created.id, originalFileName: created.originalFileName, mimeType, sizeBytes },
        },
      });

      await tx.partnerInteraction.update({
        where: { id: interactionId },
        data: { updatedAt: new Date() },
      });

      return created;
    });

    sendJson(response, 201, {
      ok: true,
      attachment: serializeInteractionAttachment(attachment),
    });
    return;
  }

  const attachmentScanResultMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/attachments\/([^/]+)\/scan-result$/);

  if (attachmentScanResultMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      scanStatus?: string;
      scanner?: string;
      reason?: string;
      actorEmail?: string;
      actorName?: string;
    };

    const body = await readJsonBody<Body>(request);
    const attachmentId = decodeURIComponent(attachmentScanResultMatch[1]);
    const scanStatus = optionalString(body.scanStatus);

    if (!scanStatus || !["clean", "blocked", "failed"].includes(scanStatus)) {
      sendError(response, 400, "invalid_scan_status", "scanStatus must be clean, blocked, or failed.");
      return;
    }

    const attachment = await prisma.interactionAttachment.findUnique({
      where: { id: attachmentId },
      include: { interaction: true },
    });

    if (!attachment || attachment.deletedAt) {
      sendError(response, 404, "attachment_not_found", "Attachment was not found.");
      return;
    }

    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.interactionAttachment.update({
        where: { id: attachmentId },
        data: { scanStatus: scanStatus as never },
      });

      await tx.interactionEvent.create({
        data: {
          interactionId: attachment.interactionId,
          eventType: "attachment_scan_result",
          actorUserId: actor.id,
          actorOrganizationId: attachment.ownerOrganizationId,
          actorOfficeId: attachment.ownerOfficeId,
          payload: {
            attachmentId,
            scanStatus,
            scanner: optionalString(body.scanner) ?? null,
            reason: optionalString(body.reason) ?? null,
          },
        },
      });

      return result;
    });

    sendJson(response, 200, {
      ok: true,
      attachment: serializeInteractionAttachment(updated),
    });
    return;
  }

  const messageReadMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/messages\/([^/]+)\/read$/);

  if (messageReadMatch && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const body = await readJsonBody<{ organizationSlug?: string; officeSlug?: string }>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(messageReadMatch[1]);
    const messageId = decodeURIComponent(messageReadMatch[2]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const message = await prisma.interactionMessage.update({
      where: { id: messageId },
      data: { readAt: new Date(), deliveryStatus: "read" },
      include: { senderOrganization: true, senderOffice: true },
    });

    sendJson(response, 200, { ok: true, message: serializeInteractionMessage(message, context.organization.id) });
    return;
  }

  const messageTranslateMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/messages\/([^/]+)\/translate$/);

  if (messageTranslateMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const body = await readJsonBody<{ organizationSlug?: string; officeSlug?: string; targetLanguage?: string; actorEmail?: string; actorName?: string }>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(messageTranslateMatch[1]);
    const messageId = decodeURIComponent(messageTranslateMatch[2]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const existingMessage = await prisma.interactionMessage.findUnique({
      where: { id: messageId },
      include: { senderOrganization: true, senderOffice: true },
    });

    if (!existingMessage || existingMessage.interactionId !== interactionId || existingMessage.deletedAt) {
      sendError(response, 404, "message_not_found", "Message was not found.");
      return;
    }

    const targetLanguage = normalizeInteractionLanguage(optionalString(body.targetLanguage) ?? interaction.conversationLanguage, interaction.conversationLanguage);
    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));

    try {
      const translation = await translateInteractionText(existingMessage.originalText, existingMessage.originalLanguage, targetLanguage);
      const updated = await prisma.$transaction(async (tx) => {
        const message = await tx.interactionMessage.update({
          where: { id: messageId },
          data: {
            translatedText: translation.translatedText,
            translatedLanguage: translation.translatedLanguage as never,
            translationStatus: translation.translationStatus,
          },
          include: { senderOrganization: true, senderOffice: true },
        });

        await tx.interactionEvent.create({
          data: {
            interactionId,
            eventType: "message_translated",
            actorUserId: actor.id,
            actorOrganizationId: context.organization.id,
            actorOfficeId: context.office.id,
            payload: { messageId, targetLanguage, provider: translation.provider },
          },
        });

        return message;
      });

      sendJson(response, 200, { ok: true, message: serializeInteractionMessage(updated, context.organization.id) });
    } catch (error) {
      const failed = await prisma.interactionMessage.update({
        where: { id: messageId },
        data: { translationStatus: "failed" },
        include: { senderOrganization: true, senderOffice: true },
      });

      await prisma.interactionEvent.create({
        data: {
          interactionId,
          eventType: "message_translation_failed",
          actorUserId: actor.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { messageId, targetLanguage, error: error instanceof Error ? error.message : "translation_failed" },
        },
      });

      sendJson(response, 502, { ok: false, error: { code: "translation_failed", message: "Message translation failed." }, message: serializeInteractionMessage(failed, context.organization.id) });
    }
    return;
  }

  const messageTranslationEditMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/messages\/([^/]+)\/translation-edit$/);

  if (messageTranslationEditMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const body = await readJsonBody<{
      organizationSlug?: string;
      officeSlug?: string;
      translatedText?: string;
      translatedLanguage?: string;
      actorEmail?: string;
      actorName?: string;
    }>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(messageTranslationEditMatch[1]);
    const messageId = decodeURIComponent(messageTranslationEditMatch[2]);
    const translatedText = optionalString(body.translatedText);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    if (!translatedText || translatedText.length > 5000) {
      sendError(response, 400, "invalid_translation_text", "Translated text is required and must be 5000 characters or less.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const existingMessage = await prisma.interactionMessage.findUnique({ where: { id: messageId } });

    if (!existingMessage || existingMessage.interactionId !== interactionId || existingMessage.deletedAt) {
      sendError(response, 404, "message_not_found", "Message was not found.");
      return;
    }

    const translatedLanguage = normalizeInteractionLanguage(optionalString(body.translatedLanguage) ?? interaction.conversationLanguage, interaction.conversationLanguage);
    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const updated = await prisma.$transaction(async (tx) => {
      const message = await tx.interactionMessage.update({
        where: { id: messageId },
        data: {
          translatedText,
          translatedLanguage: translatedLanguage as never,
          translationStatus: "edited",
        },
        include: { senderOrganization: true, senderOffice: true },
      });

      await tx.interactionEvent.create({
        data: {
          interactionId,
          eventType: "message_translation_edited",
          actorUserId: actor.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { messageId, translatedLanguage },
        },
      });

      return message;
    });

    sendJson(response, 200, { ok: true, message: serializeInteractionMessage(updated, context.organization.id) });
    return;
  }

  const messageDeleteMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/messages\/([^/]+)$/);

  if (messageDeleteMatch && request.method === "DELETE") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const interactionId = decodeURIComponent(messageDeleteMatch[1]);
    const messageId = decodeURIComponent(messageDeleteMatch[2]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    const existingMessage = await prisma.interactionMessage.findUnique({ where: { id: messageId } });

    if (!existingMessage || existingMessage.interactionId !== interactionId) {
      sendError(response, 404, "message_not_found", "Message was not found.");
      return;
    }

    if (existingMessage.senderOrganizationId !== context.organization.id) {
      sendError(response, 403, "message_delete_forbidden", "Only the message author organization can delete this message.");
      return;
    }

    if (Date.now() - existingMessage.createdAt.getTime() > 24 * 60 * 60 * 1000) {
      sendError(response, 400, "message_delete_window_closed", "Messages can be deleted only within 24 hours.");
      return;
    }

    const actor = await upsertInteractionActor(undefined);
    const message = await prisma.interactionMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedByUserId: actor.id },
      include: { senderOrganization: true, senderOffice: true },
    });

    sendJson(response, 200, { ok: true, message: serializeInteractionMessage(message, context.organization.id) });
    return;
  }

  const interactionTypingMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/typing$/);

  if (interactionTypingMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const body = await readJsonBody<{ organizationSlug?: string; officeSlug?: string }>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(interactionTypingMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    await setInteractionTyping(interactionId, context);
    sendJson(response, 200, { ok: true, expiresInMs: interactionTypingTtlMs });
    return;
  }

  const interactionStatusMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)\/status$/);

  if (interactionStatusMatch && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const interactionId = decodeURIComponent(interactionStatusMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    sendJson(response, 200, {
      ok: true,
      typing: await getInteractionTyping(interactionId, context.organization.id),
      status: interaction.status,
      updatedAt: interaction.updatedAt.toISOString(),
    });
    return;
  }

  const interactionDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/interactions\/([^/]+)$/);

  if (interactionDetailMatch && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const language = url.searchParams.get("language") ?? "ru";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const interactionId = decodeURIComponent(interactionDetailMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const interaction = await prisma.partnerInteraction.findUnique({
      where: { id: interactionId },
      include: {
        initiatingOrganization: true,
        initiatingOffice: true,
        targetOrganization: true,
        targetOffice: true,
        propertyObject: {
          include: {
            market: true,
            ownerOrganization: true,
            ownerOffice: true,
            informationOwnerOrganization: true,
            informationOwnerOffice: true,
            localizations: true,
            media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 3 },
          },
        },
        messages: { orderBy: { createdAt: "asc" }, include: { senderOrganization: true, senderOffice: true } },
        attachments: { orderBy: { createdAt: "asc" } },
        reviews: {
          where: { hiddenByPlatform: false },
          include: { reviewerOrganization: true, reviewedOrganization: true },
          orderBy: { createdAt: "desc" },
        },
        events: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!interaction || !canAccessInteraction(interaction, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    sendJson(response, 200, {
      ok: true,
      interaction: serializePartnerInteraction(interaction as never, context.organization.id, language),
    });
    return;
  }

  if (interactionDetailMatch && request.method === "PATCH") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const body = await readJsonBody<{ organizationSlug?: string; officeSlug?: string; status?: string; actorEmail?: string; actorName?: string }>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const interactionId = decodeURIComponent(interactionDetailMatch[1]);
    const nextStatus = optionalString(body.status);
    const allowedStatuses = new Set(["waiting_response", "information_received", "accepted", "declined", "in_deal", "completed", "archived"]);

    if (!context || !nextStatus || !allowedStatuses.has(nextStatus)) {
      sendError(response, 400, "invalid_status", "A valid status is required.");
      return;
    }

    const existing = await prisma.partnerInteraction.findUnique({ where: { id: interactionId } });

    if (!existing || !canAccessInteraction(existing, context)) {
      sendError(response, 404, "interaction_not_found", "Interaction was not found.");
      return;
    }

    if (!canTransitionPartnerInteractionStatus(existing.status, nextStatus)) {
      sendError(response, 400, "invalid_status_transition", `Interaction cannot transition from '${existing.status}' to '${nextStatus}'.`);
      return;
    }

    const actor = await upsertInteractionActor(optionalString(body.actorEmail), optionalString(body.actorName));
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.partnerInteraction.update({
        where: { id: interactionId },
        data: {
          status: nextStatus as never,
          ...(nextStatus === "completed" && !existing.completedAt ? { completedAt: new Date() } : {}),
          ...(nextStatus === "archived" ? { archivedAt: new Date() } : {}),
        },
        include: {
          initiatingOrganization: true,
          initiatingOffice: true,
          targetOrganization: true,
          targetOffice: true,
          propertyObject: {
            include: {
              market: true,
              ownerOrganization: true,
              ownerOffice: true,
              informationOwnerOrganization: true,
              informationOwnerOffice: true,
              localizations: true,
              media: { where: { public: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
          messages: { orderBy: { createdAt: "asc" }, include: { senderOrganization: true, senderOffice: true } },
          attachments: { orderBy: { createdAt: "asc" } },
          reviews: {
            where: { hiddenByPlatform: false },
            include: { reviewerOrganization: true, reviewedOrganization: true },
            orderBy: { createdAt: "desc" },
          },
          events: { orderBy: { createdAt: "asc" } },
        },
      });

      await tx.interactionEvent.create({
        data: {
          interactionId,
          eventType: "status_changed",
          actorUserId: actor.id,
          actorOrganizationId: context.organization.id,
          actorOfficeId: context.office.id,
          payload: { from: existing.status, to: nextStatus },
        },
      });

      return result;
    });

    sendJson(response, 200, {
      ok: true,
      interaction: serializePartnerInteraction(updated as never, context.organization.id, updated.conversationLanguage),
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/interaction-templates" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const templates = await prisma.interactionTemplate.findMany({
      where: {
        OR: [
          { system: true },
          { organizationId: context.organization.id },
        ],
      },
      orderBy: [{ system: "desc" }, { createdAt: "asc" }],
    });
    const fallbackSystemTemplates = [
      {
        id: "system-ownership-certificate",
        organizationId: null,
        name: "Запросить сертификат собственности",
        text: "Здравствуйте. Клиент заинтересован в объекте. Пожалуйста, пришлите актуальный сертификат собственности или доступные подтверждающие документы.",
        type: "info_request",
        system: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      {
        id: "system-deal-terms",
        organizationId: null,
        name: "Уточнить условия сделки",
        text: "Здравствуйте. Подскажите, пожалуйста, актуальные коммерческие условия, готовность к переговорам и возможные сроки сделки.",
        type: "commercial",
        system: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      {
        id: "system-cooperation",
        organizationId: null,
        name: "Предложение сотрудничества",
        text: "Здравствуйте. Есть клиентский интерес к объекту. Предлагаем обсудить формат совместной работы и дальнейшие шаги.",
        type: "cooperation",
        system: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ];

    sendJson(response, 200, {
      ok: true,
      templates: [
        ...fallbackSystemTemplates,
        ...templates.map((template) => ({
          id: template.id,
          organizationId: template.organizationId,
          name: template.name,
          text: template.text,
          type: template.type,
          system: template.system,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
        })),
      ],
    });
    return;
  }

  if (url.pathname === "/api/v1/admin/interaction-templates" && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    type Body = {
      organizationSlug?: string;
      officeSlug?: string;
      name?: string;
      text?: string;
      type?: string;
    };

    const body = await readJsonBody<Body>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const name = optionalString(body.name);
    const text = optionalString(body.text);

    if (!context || !name || !text) {
      sendError(response, 400, "required_fields_missing", "Template name and text are required.");
      return;
    }

    if (text.length > 5000) {
      sendError(response, 400, "template_too_long", "Template text must be 5000 characters or less.");
      return;
    }

    const template = await prisma.interactionTemplate.create({
      data: {
        organizationId: context.organization.id,
        name,
        text,
        type: (["info_request", "commercial", "cooperation"].includes(optionalString(body.type) ?? "") ? body.type : "info_request") as never,
        system: false,
      },
    });

    sendJson(response, 201, {
      ok: true,
      template: {
        id: template.id,
        organizationId: template.organizationId,
        name: template.name,
        text: template.text,
        type: template.type,
        system: template.system,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
    return;
  }

  const interactionTemplateDeleteMatch = url.pathname.match(/^\/api\/v1\/admin\/interaction-templates\/([^/]+)$/);

  if (interactionTemplateDeleteMatch && request.method === "DELETE") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const templateId = decodeURIComponent(interactionTemplateDeleteMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const template = await prisma.interactionTemplate.findFirst({
      where: { id: templateId, organizationId: context.organization.id, system: false },
    });

    if (!template) {
      sendError(response, 404, "template_not_found", "Template was not found or cannot be deleted.");
      return;
    }

    await prisma.interactionTemplate.delete({ where: { id: template.id } });
    sendJson(response, 200, { ok: true, deleted: true, templateId });
    return;
  }

  if (url.pathname === "/api/v1/admin/blocked-partners" && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);

    if (!context) {
      sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' was not found.`);
      return;
    }

    const blocked = await prisma.blockedPartner.findMany({
      where: { organizationId: context.organization.id },
      orderBy: { createdAt: "desc" },
      include: {
        blockedPartnerOrganization: {
          include: { offices: { orderBy: { legalName: "asc" }, take: 1 } },
        },
      },
    });

    sendJson(response, 200, {
      ok: true,
      blockedPartners: blocked.map((item) => ({
        id: item.id,
        partner: {
          id: item.blockedPartnerOrganization.id,
          slug: item.blockedPartnerOrganization.slug,
          legalName: item.blockedPartnerOrganization.legalName,
          primaryOffice: item.blockedPartnerOrganization.offices[0]
            ? {
                id: item.blockedPartnerOrganization.offices[0].id,
                slug: item.blockedPartnerOrganization.offices[0].slug,
                legalName: item.blockedPartnerOrganization.offices[0].legalName,
              }
            : null,
        },
        reason: item.reason,
        createdAt: item.createdAt.toISOString(),
      })),
    });
    return;
  }

  const blockedPartnerMatch = url.pathname.match(/^\/api\/v1\/admin\/blocked-partners\/([^/]+)$/);

  if (blockedPartnerMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const body = await readJsonBody<{ organizationSlug?: string; officeSlug?: string; reason?: string }>(request);
    const context = await getInteractionSideContext(optionalString(body.organizationSlug) ?? "kvartal-moscow", optionalString(body.officeSlug));
    const partnerKey = decodeURIComponent(blockedPartnerMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const partner = await prisma.organization.findFirst({
      where: { OR: [{ id: partnerKey }, { slug: partnerKey }] },
    });

    if (!partner || partner.id === context.organization.id) {
      sendError(response, 404, "partner_not_found", "Partner was not found.");
      return;
    }

    const blocked = await prisma.blockedPartner.upsert({
      where: {
        organizationId_blockedPartnerOrganizationId: {
          organizationId: context.organization.id,
          blockedPartnerOrganizationId: partner.id,
        },
      },
      update: { reason: optionalString(body.reason) },
      create: {
        organizationId: context.organization.id,
        blockedPartnerOrganizationId: partner.id,
        reason: optionalString(body.reason),
      },
    });

    sendJson(response, 200, {
      ok: true,
      blockedPartner: {
        id: blocked.id,
        partner: { id: partner.id, slug: partner.slug, legalName: partner.legalName },
        reason: blocked.reason,
        createdAt: blocked.createdAt.toISOString(),
      },
    });
    return;
  }

  if (blockedPartnerMatch && request.method === "DELETE") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const context = await getInteractionSideContext(organizationSlug, url.searchParams.get("officeSlug") ?? undefined);
    const partnerKey = decodeURIComponent(blockedPartnerMatch[1]);

    if (!context) {
      sendError(response, 404, "organization_not_found", "Organization was not found.");
      return;
    }

    const partner = await prisma.organization.findFirst({
      where: { OR: [{ id: partnerKey }, { slug: partnerKey }] },
    });

    if (!partner) {
      sendError(response, 404, "partner_not_found", "Partner was not found.");
      return;
    }

    await prisma.blockedPartner.deleteMany({
      where: {
        organizationId: context.organization.id,
        blockedPartnerOrganizationId: partner.id,
      },
    });

    sendJson(response, 200, { ok: true, deleted: true, partnerId: partner.id });
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

  const registryDriveMatch = url.pathname.match(/^\/api\/v1\/admin\/property-identity\/submissions\/([^/]+)\/process-drive-folder$/);
  if ((url.pathname === "/api/v1/admin/intake/process-drive-folder" || registryDriveMatch) && request.method === "POST") {
    if (!registryDriveMatch && !hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }
    if (registryDriveMatch && !actorContext) {
      sendError(response, 401, "REAUTH_REQUIRED", "Sign in again.");
      return;
    }

    const body = await readJsonBody<{ organizationSlug?: string; driveFolderUrl?: string; objectId?: string }>(request);
    const driveFolderUrl = body.driveFolderUrl ?? "";
    const targetObjectId = optionalString(body.objectId);
    let organizationSlug = body.organizationSlug ?? "kvartal-moscow";
    let organization: { id: string; slug: string; offices?: Array<{ id: string }> };
    let office: { id: string };
    let market: Awaited<ReturnType<typeof prisma.market.findFirst>>;
    const registrySubmissionId = registryDriveMatch ? decodeURIComponent(registryDriveMatch[1]) : null;

    if (registrySubmissionId) {
      const submission = await prisma.propertyRegistrationSubmission.findUnique({
        where: { id: registrySubmissionId },
        include: { organization: true, office: true, market: true },
      });
      const organisationAdmin = actorContext!.organizationMemberships.some((membership) => membership.organizationId === submission?.organizationId && membership.roles.some((role) => role === "organization_owner" || role === "organization_admin"));
      const officeWriter = actorContext!.officeMemberships.some((membership) => membership.organizationId === submission?.organizationId && membership.officeId === submission?.officeId && membership.roles.some((role) => role === "office_owner" || role === "office_admin" || role === "broker"));
      if (!submission || submission.createdByUserId !== actorContext!.appUserId || (!organisationAdmin && !officeWriter)) {
        sendError(response, 403, "FORBIDDEN", "Only the active submission author can run Drive intake.");
        return;
      }
      if (["CANCELLED", "CLOSED", "CONFIRMING", "CANONICAL_CREATED", "LINKED_EXISTING"].includes(submission.status)) {
        sendError(response, 409, "SUBMISSION_STATE_INVALID", "Drive intake cannot update this submission.");
        return;
      }
      organization = { ...submission.organization, offices: [{ id: submission.office.id }] };
      office = submission.office;
      market = submission.market;
      organizationSlug = submission.organization.slug;
    } else {
      const legacyOrganization = await prisma.organization.findUnique({ where: { slug: organizationSlug }, include: { offices: { take: 1 } } });
      if (!legacyOrganization || !legacyOrganization.offices[0]) {
        sendError(response, 404, "organization_not_found", `Organization '${organizationSlug}' not found.`);
        return;
      }
      organization = legacyOrganization;
      office = legacyOrganization.offices[0];
      market = await prisma.market.findFirst({ where: { active: true }, orderBy: { city: "asc" } });
      if (!market) {
        sendError(response, 400, "market_not_found", "An active market is required.");
        return;
      }
    }
    if (!targetObjectId && !registrySubmissionId) {
      const rollout = await readEffectivePropertyIdentityRollout(prisma, organization.id, market.id);
      if (rollout.registryEnabled) {
        sendError(response, 409, "property_identity_submission_required", "Create the property through a Property Identity registration submission; Drive files can be attached to that submission.");
        return;
      }
    }

    // Extract folder ID from Drive URL
    const folderIdMatch = driveFolderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (!folderIdMatch) {
      sendError(response, 400, "invalid_drive_url", "Could not extract folder ID from Drive URL.");
      return;
    }
    const folderId = folderIdMatch[1];

    // Get Google access token for Drive API
    let driveToken: string | null = null;
    try {
      const tokenRes = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        { headers: { "Metadata-Flavor": "Google" } },
      );
      if (tokenRes.ok) {
        const tokenPayload = await tokenRes.json() as { access_token?: string };
        driveToken = tokenPayload.access_token ?? null;
      }
    } catch { /* running locally */ }

    if (!driveToken && !process.env.GEMINI_API_KEY) {
      sendError(response, 503, "drive_auth_unavailable", "Drive API token not available. Running locally?");
      return;
    }

    // List files in Drive folder
    let driveFiles: DriveFile[] = [];
    if (driveToken) {
      const listRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=%27${folderId}%27+in+parents+and+trashed%3Dfalse&fields=files(id,name,mimeType,size,modifiedTime,md5Checksum,webViewLink)&pageSize=50`,
        { headers: { Authorization: `Bearer ${driveToken}` } },
      );
      if (!listRes.ok) {
        sendError(response, 502, "drive_list_failed", `Drive files list failed: ${listRes.status}`);
        return;
      }
      const listData = await listRes.json() as { files?: DriveFile[] };
      driveFiles = listData.files ?? [];
    }

    const imageFiles = driveFiles.filter((f) => f.mimeType.startsWith("image/"));
    const docFiles = driveFiles.filter((file) => supportedDriveDocumentMimeTypes.has(file.mimeType));
    const downloadedDocs: Array<{ file: DriveFile; data: DownloadedDriveFile }> = [];
    const downloadedImages: Array<{ file: DriveFile; data: DownloadedDriveFile }> = [];

    if (driveToken) {
      for (const file of docFiles) {
        const downloaded = await downloadDriveFile(file, driveToken);
        if (downloaded && downloaded.buffer.length <= maxPropertyDocumentBytes) {
          downloadedDocs.push({ file, data: downloaded });
        }
      }

      for (const file of imageFiles) {
        const downloaded = await downloadDriveFile(file, driveToken);
        if (downloaded) {
          downloadedImages.push({ file, data: downloaded });
        }
      }
    }

    // Upload files to Gemini Files API and extract property data
    const geminiFileParts: Array<{ fileData: { mimeType: string; fileUri: string } }> = [];

    if (process.env.GEMINI_API_KEY) {
      const filesToProcess = [...downloadedDocs, ...downloadedImages].slice(0, 10);
      for (const item of filesToProcess) {
        try {
          const uploaded = await uploadBufferToGeminiFile(item.data.originalFileName, item.data.mimeType, item.data.buffer);
          if (uploaded) {
            geminiFileParts.push(uploaded);
          }
        } catch { /* skip file on error */ }
      }
    }

    // Extract property data with Gemini
    const extractionPrompt = `You are a real estate data extraction specialist.
Analyze all provided files (photos, documents, PDFs, spreadsheets) and extract property listing data.
Return ONLY valid JSON matching this exact schema. Use null for unknown fields.
Language: detect from documents. Provide Russian title/description if Russian docs, English if English.

Schema:
{
  "title": "short property title in Russian",
  "titleEn": "short property title in English or null",
  "description": "full description in Russian (2-4 sentences)",
  "descriptionEn": "full description in English or null",
  "addressDisplay": "city, district/street (Russian)",
  "addressDisplayEn": "city, district/street (English) or null",
  "assetClass": "one of: land, apartment, house, office, retail, warehouse, industrial_site, hotel, development_project, investment_project, other",
  "assetSubtype": "specific subtype string or null",
  "areaSqm": number or null,
  "landAreaSqm": number or null,
  "buildingAreaSqm": number or null,
  "roomsCount": number or null,
  "bedroomsCount": number or null,
  "floorNumber": number or null,
  "floorsTotal": number or null,
  "cadastralNumber": "string or null",
  "priceAmount": number or null,
  "priceCurrency": "RUB, USD, EUR, AED, GEL, or AMD or null",
  "priceDisplay": "price as text e.g. '15 млн ₽' or null",
  "priceDisplayEn": "price as text in English or null",
  "tags": ["tag1", "tag2"],
  "tagsEn": ["tag1", "tag2"],
  "coverPhotoIndex": 0,
  "confidence": 0.85
}`;

    let extracted: Record<string, unknown> = {};
    if (geminiFileParts.length > 0) {
      try {
        const geminiResult = await callGemini(
          extractionPrompt,
          geminiFileParts,
        );
        const parsed = parseGeminiJson(geminiResult);
        if (parsed && typeof parsed === "object") extracted = parsed as Record<string, unknown>;
      } catch { /* use empty extracted */ }
    }

    if (registrySubmissionId) {
      const requiredFields = ["title", "addressDisplay", "assetClass"];
      const missingFields = requiredFields.filter((field) => extracted[field] === null || extracted[field] === undefined || extracted[field] === "");
      const confidenceValue = Number(extracted.confidence ?? 0);
      const confidence = confidenceValue >= 0.8 ? "high" : confidenceValue >= 0.5 ? "medium" : "low";
      try {
        const result = await recordPropertyIdentityDriveDraft({
          prisma,
          actor: actorContext!,
          request,
          submissionId: registrySubmissionId,
          driveFolderUrl,
          fileRefs: driveFiles.map((file) => `google-drive:${file.id}`),
          extracted,
          confidence,
          missingFields,
        });
        sendJson(response, result.status, { ...result.payload, driveFilesFound: driveFiles.length, idempotentReplay: result.replay });
      } catch (caught) {
        const error = caught as { status?: number; code?: string; message?: string };
        sendJson(response, error.status ?? 500, { ok: false, error: { code: error.code ?? "DRIVE_INTAKE_FAILED", message: error.status && error.status < 500 ? error.message : "Drive intake failed.", correlationId: actorContext!.correlationId } });
      }
      return;
    }

    const existingObject = targetObjectId
      ? await prisma.propertyObject.findFirst({
          where: { id: targetObjectId, ownerOrganization: { slug: organizationSlug } },
          include: {
            localizations: true,
            ownerOrganization: true,
            ownerOffice: true,
            informationOwnerOrganization: true,
            informationOwnerOffice: true,
            market: true,
            media: { orderBy: { sortOrder: "asc" } },
            documents: { include: { versions: { orderBy: { versionNumber: "desc" }, take: 5 } } },
            aiAnalyses: { orderBy: { analyzedAt: "desc" }, take: 1, include: { proposals: true } },
          },
        })
      : null;

    if (targetObjectId && !existingObject) {
      sendError(response, 404, "object_not_found", `Object '${targetObjectId}' was not found for '${organizationSlug}'.`);
      return;
    }

    // Create draft object when no target object is supplied.
    const title = String(extracted.title ?? "Новый объект (AI черновик)");
    const addressDisplay = String(extracted.addressDisplay ?? "Адрес уточняется");

    const newObject = existingObject ?? await prisma.propertyObject.create({
        data: {
          ownerOrganizationId: organization.id,
          ownerOfficeId: office.id,
          informationOwnerOrganizationId: organization.id,
          informationOwnerOfficeId: office.id,
          createdByUserId: (await prisma.appUser.findFirst())!.id,
          marketId: market!.id,
          assetClass: (extracted.assetClass as string ?? "other") as never,
          assetSubtype: extracted.assetSubtype as string ?? null,
          status: "draft",
          visibility: "private",
          areaSqm: extracted.areaSqm ? String(extracted.areaSqm) as never : null,
          landAreaSqm: extracted.landAreaSqm ? String(extracted.landAreaSqm) as never : null,
          buildingAreaSqm: extracted.buildingAreaSqm ? String(extracted.buildingAreaSqm) as never : null,
          roomsCount: extracted.roomsCount as number ?? null,
          bedroomsCount: extracted.bedroomsCount as number ?? null,
          floorNumber: extracted.floorNumber as number ?? null,
          floorsTotal: extracted.floorsTotal as number ?? null,
          cadastralNumber: extracted.cadastralNumber as string ?? null,
          priceAmount: extracted.priceAmount ? String(extracted.priceAmount) as never : null,
          priceCurrency: (extracted.priceCurrency as string ?? null) as never,
          priceMode: extracted.priceAmount ? "fixed" : "on_request",
          driveIntakeFolderUrl: driveFolderUrl,
          driveIntakeProcessedAt: new Date(),
          driveIntakeConfidence: extracted.confidence as number ?? null,
          driveIntakePending: true,
          localizations: {
            create: [
              {
                language: "ru",
                title,
                description: extracted.description as string ?? null,
                addressDisplay,
                tags: (extracted.tags as string[]) ?? [],
                priceDisplay: extracted.priceDisplay as string ?? null,
              },
              ...(extracted.titleEn ? [{
                language: "en" as const,
                title: extracted.titleEn as string,
                description: extracted.descriptionEn as string ?? null,
                addressDisplay: extracted.addressDisplayEn as string ?? addressDisplay,
                tags: (extracted.tagsEn as string[]) ?? [],
                priceDisplay: extracted.priceDisplayEn as string ?? null,
              }] : []),
            ],
          },
        },
      });

    if (existingObject) {
      await prisma.propertyObject.update({
        where: { id: existingObject.id },
        data: {
          driveIntakeFolderUrl: driveFolderUrl,
          driveIntakeProcessedAt: new Date(),
          driveIntakeConfidence: extracted.confidence as number ?? existingObject.driveIntakeConfidence,
        },
      });
    }

    // Upload images from Drive to GCS and register as media
    let mediaCount = 0;
    const coverIndex = Number(extracted.coverPhotoIndex ?? 0);

    if (driveToken) {
      for (let i = 0; i < downloadedImages.length; i++) {
        const { file: imgFile, data: imgData } = downloadedImages[i]!;
        try {
          const existingMedia = await prisma.propertyMedia.findFirst({
            where: { propertyObjectId: newObject.id, originalFileName: imgData.originalFileName, sizeBytes: BigInt(imgData.buffer.length) },
          });
          if (existingMedia) continue;
          const ext = imgData.mimeType === "image/png" ? "png" : imgData.mimeType === "image/webp" ? "webp" : "jpg";
          const mediaId = randomUUID();
          const isCover = i === coverIndex;
          const storagePath = `organizations/${organization.id}/offices/${office.id}/objects/${newObject.id}/public/media/${mediaId}/original.${ext}`;

          await storageBucket.file(storagePath).save(imgData.buffer, {
            metadata: { contentType: imgData.mimeType },
          });

          await prisma.propertyMedia.create({
            data: {
              propertyObjectId: newObject.id,
              ownerOrganizationId: organization.id,
              ownerOfficeId: office.id,
              storagePath,
              kind: "image",
              public: true,
              sortOrder: isCover ? 0 : (i + 1) * 10,
              originalFileName: imgData.originalFileName,
              mimeType: imgData.mimeType,
              sizeBytes: imgData.buffer.length,
            },
          });
          mediaCount++;
        } catch { /* skip image on error */ }
      }
    }

    let importedDocumentCount = 0;
    let newDocumentVersionCount = 0;

    for (const { file, data } of downloadedDocs) {
      const checksum = file.md5Checksum ?? createHash("sha256").update(data.buffer).digest("hex");
      const existingDocument = await prisma.propertyDocument.findUnique({
        where: { propertyObjectId_driveFileId: { propertyObjectId: newObject.id, driveFileId: file.id } },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      });
      const existingChecksum = existingDocument?.driveChecksum ?? existingDocument?.checksum;
      const existingModified = existingDocument?.driveModifiedTime?.toISOString();
      const driveModifiedTime = file.modifiedTime ? new Date(file.modifiedTime) : null;

      if (existingDocument && existingChecksum === checksum && existingModified === driveModifiedTime?.toISOString()) {
        importedDocumentCount++;
        continue;
      }

      const versionNumber = existingDocument ? existingDocument.currentVersion + 1 : 1;
      const documentId = existingDocument?.id ?? randomUUID();
      const extension = extensionForFileName(data.originalFileName, data.mimeType);
      const storagePath = [
        "organizations",
        newObject.ownerOrganizationId,
        "offices",
        newObject.ownerOfficeId,
        "objects",
        newObject.id,
        "private",
        "documents",
        documentId,
        `v${versionNumber}`,
        `original.${extension}`,
      ].join("/");

      await storageBucket.file(storagePath).save(data.buffer, {
        metadata: { contentType: data.mimeType },
      });

      const documentType = normalizePropertyDocumentType(undefined, data.originalFileName);
      const fallbackAnalysis = fallbackDocumentAnalysis(data.originalFileName, documentType, versionNumber, Boolean(existingDocument));

      const document = existingDocument
        ? await prisma.propertyDocument.update({
            where: { id: existingDocument.id },
            data: {
              title: data.originalFileName,
              storagePath,
              documentType: documentType as never,
              source: "google_drive",
              currentVersion: versionNumber,
              driveModifiedTime,
              driveChecksum: checksum,
              driveWebUrl: file.webViewLink ?? existingDocument.driveWebUrl,
              originalFileName: data.originalFileName,
              mimeType: data.mimeType,
              sizeBytes: BigInt(data.buffer.length),
              checksum,
              analysisStatus: "analyzed",
              aiSummary: fallbackAnalysis.summary as never,
              aiFacts: fallbackAnalysis.facts as never,
              aiRisks: fallbackAnalysis.risks as never,
              aiRecommendations: fallbackAnalysis.recommendations as never,
              aiMissingItems: fallbackAnalysis.missingItems as never,
              aiConflicts: fallbackAnalysis.conflicts as never,
              aiChangeSummary: fallbackAnalysis.changeSummary as never,
              aiAnalyzedAt: new Date(),
            },
          })
        : await prisma.propertyDocument.create({
            data: {
              id: documentId,
              propertyObjectId: newObject.id,
              ownerOrganizationId: newObject.ownerOrganizationId,
              ownerOfficeId: newObject.ownerOfficeId,
              title: data.originalFileName,
              storagePath,
              documentType: documentType as never,
              source: "google_drive",
              currentVersion: versionNumber,
              driveFileId: file.id,
              driveModifiedTime,
              driveChecksum: checksum,
              driveWebUrl: file.webViewLink ?? null,
              originalFileName: data.originalFileName,
              mimeType: data.mimeType,
              sizeBytes: BigInt(data.buffer.length),
              checksum,
              analysisStatus: "analyzed",
              aiSummary: fallbackAnalysis.summary as never,
              aiFacts: fallbackAnalysis.facts as never,
              aiRisks: fallbackAnalysis.risks as never,
              aiRecommendations: fallbackAnalysis.recommendations as never,
              aiMissingItems: fallbackAnalysis.missingItems as never,
              aiConflicts: fallbackAnalysis.conflicts as never,
              aiChangeSummary: fallbackAnalysis.changeSummary as never,
              aiAnalyzedAt: new Date(),
            },
          });

      await prisma.propertyDocumentVersion.create({
        data: {
          propertyDocumentId: document.id,
          versionNumber,
          storagePath,
          originalFileName: data.originalFileName,
          mimeType: data.mimeType,
          sizeBytes: BigInt(data.buffer.length),
          checksum,
          driveModifiedTime,
          driveChecksum: checksum,
          aiAnalysis: fallbackAnalysis as never,
          aiChangeSummary: fallbackAnalysis.changeSummary as never,
          comparedToVersion: existingDocument ? versionNumber - 1 : null,
        },
      });

      importedDocumentCount++;
      newDocumentVersionCount++;
    }

    const objectForAnalysis = await prisma.propertyObject.findUnique({
      where: { id: newObject.id },
      include: {
        localizations: true,
        documents: { include: { versions: { orderBy: { versionNumber: "desc" }, take: 5 } } },
      },
    });
    let aiAnalysisId: string | null = null;
    let proposalCount = 0;

    if (objectForAnalysis) {
      const analysisFileParts = geminiFileParts.length
        ? geminiFileParts
        : objectForAnalysis.documents
            .filter((document) => document.mimeType)
            .slice(0, 10)
            .map((document) => ({
              fileData: {
                mimeType: document.mimeType ?? "application/pdf",
                fileUri: `gs://${storageBucketName}/${document.storagePath}`,
              },
            }));
      const aiDossier = await analyzeObjectDocumentsWithAI({
        propertyObject: {
          id: objectForAnalysis.id,
          assetClass: objectForAnalysis.assetClass,
          assetSubtype: objectForAnalysis.assetSubtype,
          areaSqm: objectForAnalysis.areaSqm,
          landAreaSqm: objectForAnalysis.landAreaSqm,
          buildingAreaSqm: objectForAnalysis.buildingAreaSqm,
          cadastralNumber: objectForAnalysis.cadastralNumber,
          priceAmount: objectForAnalysis.priceAmount,
          priceCurrency: objectForAnalysis.priceCurrency,
          ownerOrganizationId: objectForAnalysis.ownerOrganizationId,
          ownerOfficeId: objectForAnalysis.ownerOfficeId,
          localizations: objectForAnalysis.localizations,
        },
        documents: objectForAnalysis.documents as PropertyDocumentRow[],
        geminiFileParts: analysisFileParts,
      });
      const analysis = await prisma.propertyObjectAIAnalysis.create({
        data: {
          propertyObjectId: objectForAnalysis.id,
          organizationId: objectForAnalysis.ownerOrganizationId,
          officeId: objectForAnalysis.ownerOfficeId,
          status: "analyzed",
          provider: process.env.GEMINI_API_KEY ? "gemini-api" : "system-fallback",
          model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
          summary: aiDossier.summary as never,
          confirmedFacts: aiDossier.confirmedFacts as never,
          risks: aiDossier.risks as never,
          recommendations: aiDossier.recommendations as never,
          missingDocuments: aiDossier.missingDocuments as never,
          conflicts: aiDossier.conflicts as never,
          changeLog: aiDossier.changeLog as never,
          fieldProposals: aiDossier.fieldProposals as never,
        },
      });
      aiAnalysisId = analysis.id;

      for (const proposal of normalizeAIArray(aiDossier.fieldProposals).slice(0, 20) as Array<Record<string, unknown>>) {
        const fieldPath = optionalString(proposal.fieldPath);
        if (!fieldPath) continue;
        await prisma.propertyObjectAIFieldProposal.create({
          data: {
            analysisId: analysis.id,
            propertyObjectId: objectForAnalysis.id,
            organizationId: objectForAnalysis.ownerOrganizationId,
            fieldPath,
            currentValue: proposal.currentValue === undefined || proposal.currentValue === null ? Prisma.JsonNull : (proposal.currentValue as never),
            proposedValue: proposal.proposedValue === undefined || proposal.proposedValue === null ? Prisma.JsonNull : (proposal.proposedValue as never),
            sourceDocumentIds: Array.isArray(proposal.sourceDocumentIds) ? proposal.sourceDocumentIds.map(String) : [],
            confidence: (["high", "medium", "low", "unsupported"].includes(String(proposal.confidence)) ? proposal.confidence : "medium") as never,
            rationale: optionalString(proposal.rationale),
          },
        });
        proposalCount++;
      }
    }

    sendJson(response, 200, {
      ok: true,
      objectId: newObject.id,
      confidence: extracted.confidence ?? null,
      fieldsExtracted: Object.keys(extracted).filter((k) => extracted[k] !== null).length,
      mediaCount,
      importedDocumentCount,
      newDocumentVersionCount,
      aiAnalysisId,
      proposalCount,
      driveFilesFound: driveFiles.length,
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

    const rollout = await readEffectivePropertyIdentityRollout(prisma, organization.id, market.id);
    if (rollout.registryEnabled) {
      sendError(response, 409, "property_identity_submission_required", "Create the property through a Property Identity registration submission.");
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

  const adminDocumentMatch = url.pathname.match(/^\/api\/v1\/admin\/documents\/([^/]+)$/);

  if (adminDocumentMatch && request.method === "GET") {
    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const documentId = decodeURIComponent(adminDocumentMatch[1]);
    const document = await prisma.propertyDocument.findFirst({
      where: { id: documentId, propertyObject: { ownerOrganization: { slug: organizationSlug } } },
    });

    if (!document) {
      sendError(response, 404, "document_not_found", "Document was not found.");
      return;
    }

    const [metadata] = await storageBucket.file(document.storagePath).getMetadata();
    streamStorageFile(response, document.storagePath, metadata, "private, max-age=300");
    return;
  }

  if (adminDocumentMatch && request.method === "DELETE") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const organizationSlug = url.searchParams.get("organizationSlug") ?? "kvartal-moscow";
    const documentId = decodeURIComponent(adminDocumentMatch[1]);
    const document = await prisma.propertyDocument.findFirst({
      where: { id: documentId, propertyObject: { ownerOrganization: { slug: organizationSlug } } },
      include: { versions: true },
    });

    if (!document) {
      sendError(response, 404, "document_not_found", "Document was not found.");
      return;
    }

    await Promise.all([
      storageBucket.file(document.storagePath).delete({ ignoreNotFound: true }),
      ...document.versions.map((version) => storageBucket.file(version.storagePath).delete({ ignoreNotFound: true })),
    ]);
    await prisma.propertyDocument.delete({ where: { id: document.id } });

    sendJson(response, 200, { ok: true, deletedDocumentId: document.id });
    return;
  }

  const aiProposalMatch = url.pathname.match(/^\/api\/v1\/admin\/objects\/([^/]+)\/ai-proposals\/([^/]+)$/);

  if (aiProposalMatch && request.method === "POST") {
    if (!hasAdminWriteAccess(request)) {
      sendError(response, 403, "admin_write_forbidden", "Admin write token is missing or invalid.");
      return;
    }

    const objectId = decodeURIComponent(aiProposalMatch[1]);
    const proposalId = decodeURIComponent(aiProposalMatch[2]);
    const body = await readJsonBody<{ organizationSlug?: string; action?: string; decidedByEmail?: string }>(request);
    const organizationSlug = optionalString(body.organizationSlug) ?? "kvartal-moscow";
    const action = optionalString(body.action) ?? "accept";
    const proposal = await prisma.propertyObjectAIFieldProposal.findFirst({
      where: {
        id: proposalId,
        propertyObjectId: objectId,
        organization: { slug: organizationSlug },
        status: "pending",
      },
      include: {
        propertyObject: {
          include: { localizations: true, ownerOrganization: true },
        },
      },
    });

    if (!proposal) {
      sendError(response, 404, "proposal_not_found", "AI field proposal was not found.");
      return;
    }

    const decidedByEmail = optionalString(body.decidedByEmail)?.toLowerCase();
    const decidedByUser = decidedByEmail
      ? await prisma.appUser.upsert({
          where: { email: decidedByEmail },
          update: { active: true },
          create: { firebaseUid: `pending:${decidedByEmail}`, email: decidedByEmail, active: true },
        })
      : null;

    if (action === "reject") {
      await prisma.propertyObjectAIFieldProposal.update({
        where: { id: proposal.id },
        data: { status: "rejected", decidedByUserId: decidedByUser?.id ?? null, decidedAt: new Date() },
      });
      sendJson(response, 200, { ok: true, status: "rejected" });
      return;
    }

    const value = proposal.proposedValue === null || proposal.proposedValue === undefined ? null : String(proposal.proposedValue);
    const localizationFields = new Set(["title", "description", "addressDisplay", "priceDisplay"]);
    const objectStringFields = new Set(["assetSubtype", "cadastralNumber"]);
    const objectDecimalFields = new Set(["areaSqm", "landAreaSqm", "buildingAreaSqm", "priceAmount"]);
    const objectEnumFields = new Set(["priceCurrency"]);

    if (localizationFields.has(proposal.fieldPath)) {
      const localization = proposal.propertyObject.localizations.find((item) => item.language === "ru") ?? proposal.propertyObject.localizations[0];
      if (!localization) {
        sendError(response, 400, "localization_missing", "Object localization is missing.");
        return;
      }
      await prisma.propertyObjectLocalization.update({
        where: { id: localization.id },
        data: { [proposal.fieldPath]: value ?? "" },
      });
    } else if (objectStringFields.has(proposal.fieldPath)) {
      await prisma.propertyObject.update({
        where: { id: proposal.propertyObjectId },
        data: { [proposal.fieldPath]: value },
      });
    } else if (objectDecimalFields.has(proposal.fieldPath)) {
      await prisma.propertyObject.update({
        where: { id: proposal.propertyObjectId },
        data: { [proposal.fieldPath]: value ? value.replace(",", ".") : null },
      });
    } else if (objectEnumFields.has(proposal.fieldPath)) {
      await prisma.propertyObject.update({
        where: { id: proposal.propertyObjectId },
        data: { [proposal.fieldPath]: value as never },
      });
    } else {
      sendError(response, 400, "unsupported_proposal_field", `Field '${proposal.fieldPath}' cannot be applied automatically.`);
      return;
    }

    await prisma.propertyObjectAIFieldProposal.update({
      where: { id: proposal.id },
      data: { status: "accepted", decidedByUserId: decidedByUser?.id ?? null, decidedAt: new Date() },
    });

    sendJson(response, 200, { ok: true, status: "accepted", fieldPath: proposal.fieldPath });
    return;
  }

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
        identityProfile: {
          include: { canonicalVersions: { where: { isCurrent: true }, select: { id: true } } },
        },
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
    if (status === "published") {
      const rollout = await readEffectivePropertyIdentityRollout(prisma, existing.ownerOrganizationId, (market ?? existing.market).id);
      const registryManagedPublication = rollout.mode === "STRICT" || !rollout.activationAt || existing.createdAt >= rollout.activationAt;
      if (rollout.publishGateEnabled && registryManagedPublication && (existing.identityProfile?.status !== "VERIFIED_INTERNAL" || existing.identityProfile.canonicalVersions.length !== 1)) {
        sendError(response, 409, "property_identity_verification_required", "The property must have one verified Property Identity profile and one current canonical version before publication.");
        return;
      }
    }

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
