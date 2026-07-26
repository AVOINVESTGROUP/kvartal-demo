import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../lib/auth";
import { deleteBackendJson, fetchBackendJson, fetchSecureActorBackendJson, writeBackendJson, writeSecureActorBackendJson } from "../lib/server-api";
import { MediaUploadForm } from "./MediaUploadForm";

export const dynamic = "force-dynamic";

type AdminContextResponse = {
  organization: {
    slug: string;
    legalName: string;
    countryOfRegistration: string;
    operatingCountryCodes: string[];
    status: string;
    defaultLanguage: string;
    defaultCurrency: string;
    siteConfig: {
      domain: string | null;
      subdomain: string | null;
      showPartnerObjects: boolean;
      active: boolean;
    };
    counts: {
      ownedObjects: number;
      informationOwnedObjects: number;
      clientIntents: number;
      sharedPublicInventory: number;
    };
    offices: Array<{
      slug: string;
      legalName: string;
      city: string;
      country: string;
      status: string;
      defaultMarket: { slug: string; city: string; country: string } | null;
      counts: {
        propertyObjects: number;
        clientIntents: number;
      };
    }>;
    members: Array<{
      id: string;
      email: string;
      displayName: string | null;
      roles: string[];
      active: boolean;
    }>;
  };
};

type AdminObjectsResponse = {
  objects: Array<{
    id: string;
    title: string;
    description: string | null;
    addressDisplay: string | null;
    assetClass: string;
    assetSubtype: string | null;
    status: string;
    visibility: string;
    canBeShownByOtherOffices: boolean;
    areaSqm: string | null;
    landAreaSqm: string | null;
    buildingAreaSqm: string | null;
    priceDisplay: string | null;
    priceCurrency: string | null;
    cadastralNumber: string | null;
    identity: null | {
      stableId: string;
      status: string;
      representationStatus: string | null;
      offerStatus: string | null;
      isOriginator: boolean;
    };
    titleEn: string | null;
    descriptionEn: string | null;
    addressDisplayEn: string | null;
    tags: string[];
    tagsEn: string[];
    priceDisplayEn: string | null;
    market: { city: string; country: string; slug: string };
    sellerSide: { officeName: string; organizationName: string };
    informationRightsHolder: { officeName: string; organizationName: string };
    media: Array<{
      id: string;
      url: string;
      kind: string;
      public: boolean;
      sortOrder: number;
      title: string | null;
      caption: string | null;
    }>;
    mediaCount: number;
    documents: Array<{
      id: string;
      title: string;
      documentType: string;
      label: string;
      source: string;
      currentVersion: number;
      url: string;
      driveWebUrl: string | null;
      originalFileName: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
      analysisStatus: string;
      aiSummary: unknown;
      aiFacts: unknown;
      aiRisks: unknown;
      aiRecommendations: unknown;
      aiMissingItems: unknown;
      aiConflicts: unknown;
      aiChangeSummary: unknown;
      aiAnalyzedAt: string | null;
      updatedAt: string;
      versions: Array<{
        id: string;
        versionNumber: number;
        originalFileName: string | null;
        checksum: string | null;
        aiChangeSummary: unknown;
        createdAt: string;
      }>;
    }>;
    documentCompleteness: {
      required: Array<{ type: string; label: string; status: string; documentIds: string[] }>;
      requiredCount: number;
      presentCount: number;
      missingCount: number;
      score: number;
    };
    aiDossier: null | {
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
      analyzedAt: string;
      proposals: Array<{
        id: string;
        fieldPath: string;
        currentValue: unknown;
        proposedValue: unknown;
        sourceDocumentIds: string[];
        confidence: string;
        rationale: string | null;
        status: string;
      }>;
    };
    publishedAt: string | null;
    updatedAt: string;
    driveIntakeFolderUrl: string | null;
    driveIntakeConfidence: number | null;
    driveIntakePending: boolean;
  }>;
};

type AdminPartnerObjectsResponse = {
  objects: Array<AdminObjectsResponse["objects"][number] & {
    hiddenOnThisSite: boolean;
  }>;
};

type AdminReferenceResponse = {
  offices: Array<{
    slug: string;
    legalName: string;
    city: string;
    country: string;
    defaultMarketSlug: string | null;
  }>;
  markets: Array<{
    slug: string;
    city: string;
    country: string;
    defaultCurrency: string;
    assetClasses: string[];
  }>;
  assetClasses: string[];
};

function formatArea(object: AdminObjectsResponse["objects"][number]) {
  const value = object.areaSqm ?? object.landAreaSqm ?? object.buildingAreaSqm;

  return value ? `${Number(value).toLocaleString("ru-RU")} м²` : "Не указано";
}

function assetLabel(assetClass: string) {
  const labels: Record<string, string> = {
    land: "Земля",
    apartment: "Квартира",
    house: "Дом",
    office: "Офис",
    industrial_site: "Промышленный объект",
    development_project: "Девелоперский проект",
    investment_project: "Инвестиционный проект",
  };

  return labels[assetClass] ?? assetClass;
}

function resolveMediaUrl(url: string | undefined) {
  if (!url) {
    return null;
  }

  if (url.startsWith("/api/")) {
    return url;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const baseUrl = process.env.PUBLIC_SITE_BASE_URL ?? "https://partner-site-dev--kvartal-dev.europe-west4.hosted.app";

  return `${baseUrl}${url}`;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) return String((item as { text?: unknown }).text ?? "");
      if (item && typeof item === "object" && "reason" in item) return String((item as { reason?: unknown }).reason ?? "");
      if (item && typeof item === "object" && "change" in item) return String((item as { change?: unknown }).change ?? "");
      return JSON.stringify(item);
    }).filter(Boolean);
  }

  return [];
}

function summaryText(value: unknown) {
  if (value && typeof value === "object" && "short" in value) {
    return String((value as { short?: unknown }).short ?? "");
  }

  return typeof value === "string" ? value : "";
}

function fieldValue(value: unknown) {
  if (value === null || value === undefined) return "не заполнено";
  if (typeof value === "string") return value || "пусто";
  return JSON.stringify(value);
}

function formatFileSize(value: number | null) {
  if (!value) return "не указан";
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "dark" }) {
  const toneClass = {
    neutral: "border-kv-line bg-white text-kv-muted",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    dark: "border-kv-navy bg-kv-navy text-white",
  }[tone];

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-black ${toneClass}`}>{children}</span>;
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function formPayload(formData: FormData, organizationSlug: string) {
  return {
    organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    marketSlug: formValue(formData, "marketSlug"),
    assetClass: formValue(formData, "assetClass"),
    assetSubtype: formValue(formData, "assetSubtype"),
    status: formValue(formData, "status"),
    visibility: formValue(formData, "visibility"),
    canBeShownByOtherOffices: formData.get("canBeShownByOtherOffices") === "on",
    title: formValue(formData, "title"),
    titleEn: formValue(formData, "titleEn"),
    description: formValue(formData, "description"),
    descriptionEn: formValue(formData, "descriptionEn"),
    addressDisplay: formValue(formData, "addressDisplay"),
    addressDisplayEn: formValue(formData, "addressDisplayEn"),
    tags: formValue(formData, "tags"),
    tagsEn: formValue(formData, "tagsEn"),
    areaSqm: formValue(formData, "areaSqm"),
    landAreaSqm: formValue(formData, "landAreaSqm"),
    buildingAreaSqm: formValue(formData, "buildingAreaSqm"),
    rentableAreaSqm: formValue(formData, "rentableAreaSqm"),
    cadastralNumber: formValue(formData, "cadastralNumber"),
    priceDisplay: formValue(formData, "priceDisplay"),
    priceDisplayEn: formValue(formData, "priceDisplayEn"),
    priceAmount: formValue(formData, "priceAmount"),
    priceCurrency: formValue(formData, "priceCurrency"),
    mediaUrl: formValue(formData, "mediaUrl"),
  };
}

async function createObjectAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  await writeSecureActorBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/objects", "POST", formPayload(formData, session.organizationSlug), {
    "Idempotency-Key": `object-form:${crypto.randomUUID()}`,
  });
  revalidatePath("/");
}

async function fillFromDriveAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const driveFolderUrl = formValue(formData, "driveFolderUrl");
  if (!driveFolderUrl) return;
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/intake/process-drive-folder", "POST", {
    organizationSlug: session.organizationSlug,
    driveFolderUrl,
  });
  revalidatePath("/");
}

async function syncObjectDriveAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const objectId = formValue(formData, "objectId");
  const driveFolderUrl = formValue(formData, "driveFolderUrl");
  if (!objectId || !driveFolderUrl) return;
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/intake/process-drive-folder", "POST", {
    organizationSlug: session.organizationSlug,
    objectId,
    driveFolderUrl,
  });
  revalidatePath("/");
}

async function deleteDocumentAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const documentId = formValue(formData, "documentId");
  if (!documentId) return;
  await deleteBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/documents/${encodeURIComponent(documentId)}?organizationSlug=${encodeURIComponent(session.organizationSlug)}`,
  );
  revalidatePath("/");
}

async function reviewAIProposalAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const objectId = formValue(formData, "objectId");
  const proposalId = formValue(formData, "proposalId");
  const action = formValue(formData, "proposalAction");
  if (!objectId || !proposalId) return;
  await writeBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/objects/${encodeURIComponent(objectId)}/ai-proposals/${encodeURIComponent(proposalId)}`,
    "POST",
    {
      organizationSlug: session.organizationSlug,
      decidedByEmail: session.email,
      action,
    },
  );
  revalidatePath("/");
}

async function updateObjectAction(formData: FormData) {
  "use server";

  const objectId = formValue(formData, "objectId");
  const action = formValue(formData, "action") || "save";

  const session = await requireAdminSession();
  await writeSecureActorBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/objects/${encodeURIComponent(objectId)}`, "PATCH", {
    ...formPayload(formData, session.organizationSlug),
    action,
    clearMedia: formData.get("clearMedia") === "on",
  }, {
    "Idempotency-Key": `object-update:${objectId}:${crypto.randomUUID()}`,
  });
  revalidatePath("/");
}

async function updateAccessSettingsAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const showPartnerObjectsValue = formValue(formData, "showPartnerObjects");
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/access-settings", "PATCH", {
    organizationSlug: session.organizationSlug,
    showPartnerObjects: showPartnerObjectsValue ? showPartnerObjectsValue === "true" : formData.get("showPartnerObjects") === "on",
  });
  revalidatePath("/");
}

async function updatePartnerObjectVisibilityAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/partner-object-visibility", "PATCH", {
    organizationSlug: session.organizationSlug,
    propertyObjectId: formValue(formData, "propertyObjectId"),
    hidden: formValue(formData, "hidden") === "true",
  });
  revalidatePath("/");
}

async function createMemberAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/members", "POST", {
    organizationSlug: session.organizationSlug,
    email: formValue(formData, "email"),
    displayName: formValue(formData, "displayName"),
    organizationRole: formValue(formData, "organizationRole"),
    officeSlug: formValue(formData, "officeSlug"),
    officeRole: formValue(formData, "officeRole"),
  });
  revalidatePath("/");
}

async function setCoverMediaAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const mediaId = formValue(formData, "mediaId");
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/media/${encodeURIComponent(mediaId)}`, "PATCH", {
    organizationSlug: session.organizationSlug,
    action: "set_cover",
    public: true,
  });
  revalidatePath("/");
}

async function deleteMediaAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const mediaId = formValue(formData, "mediaId");
  await deleteBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/media/${encodeURIComponent(mediaId)}?organizationSlug=${encodeURIComponent(session.organizationSlug)}`,
  );
  revalidatePath("/");
}

export default async function PartnerAdminHome({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireAdminSession();
  const params = searchParams ? await searchParams : {};

  const organizationSlug = session.organizationSlug;
  const [context, objectResponse, partnerObjectResponse, reference] = await Promise.all([
    fetchBackendJson<AdminContextResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/context?organizationSlug=${encodeURIComponent(organizationSlug)}`,
    ),
    fetchSecureActorBackendJson<AdminObjectsResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/objects?organizationSlug=${encodeURIComponent(organizationSlug)}&language=ru&limit=100`,
    ),
    fetchBackendJson<AdminPartnerObjectsResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/partner-objects?organizationSlug=${encodeURIComponent(organizationSlug)}&language=ru&limit=100`,
    ),
    fetchBackendJson<AdminReferenceResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/reference?organizationSlug=${encodeURIComponent(organizationSlug)}`,
    ),
  ]);

  const organization = context?.organization;
  const objects = objectResponse?.objects ?? [];
  const partnerObjects = partnerObjectResponse?.objects ?? [];
  const visiblePartnerObjects = partnerObjects.filter((object) => !object.hiddenOnThisSite);
  const hiddenPartnerObjects = partnerObjects.filter((object) => object.hiddenOnThisSite);
  const publicObjects = objects.filter((object) => object.status === "published" && object.visibility === "public");
  const sharedObjects = publicObjects.filter((object) => object.canBeShownByOtherOffices);
  const missingMedia = objects.filter((object) => object.mediaCount === 0);
  const markets = new Set(objects.map((object) => `${object.market.city}, ${object.market.country}`));
  const offices = reference?.offices ?? [];
  const marketOptions = reference?.markets ?? [];
  const assetClasses = reference?.assetClasses ?? ["land", "apartment", "house", "office", "industrial_site", "development_project"];
  const members = organization?.members ?? [];
  const showPartnerObjects = organization?.siteConfig.showPartnerObjects ?? true;
  const selectedObjectId = typeof params.objectId === "string" ? params.objectId : undefined;
  const selectedTab = typeof params.tab === "string" ? params.tab : "summary";
  const selectedObject = objects.find((object) => object.id === selectedObjectId) ?? objects.find((object) => !object.driveIntakePending) ?? objects[0] ?? null;
  const dossierTabs = [
    ["summary", "Сводка"],
    ["description", "Описание"],
    ["documents", "Документы"],
    ["ai", "AI-анализ"],
    ["changes", "Изменения"],
    ["media", "Медиа"],
    ["publication", "Публикация"],
  ];

  return (
    <main className="min-h-screen bg-kv-bg text-kv-ink">
      <header className="border-b border-kv-line bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">Fixer.guru Partner Admin</div>
            <h1 className="mt-2 text-[32px] font-black tracking-tight text-kv-navy">{organization?.legalName ?? "Partner organization"}</h1>
            <p className="mt-2 max-w-[860px] text-[15px] leading-6 text-kv-muted">
              Рабочий кабинет организации: объекты, права на информацию, публикация в общей витрине и контроль качества карточек.
            </p>
          </div>
          <div className="flex max-w-[360px] flex-col gap-2 rounded-md border border-kv-line bg-kv-bg p-3 text-[13px]">
            <div className="font-black text-kv-navy">{session.name ?? session.email}</div>
            <div className="text-kv-muted">{session.email}</div>
            <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{organization?.status ?? "loading"}</Badge>
            <Badge>{organization?.countryOfRegistration ?? "RU"}</Badge>
            <Badge>{organization?.defaultCurrency ?? "RUB"}</Badge>
            {session.roles.map((role) => <Badge key={role}>{role}</Badge>)}
            </div>
            <a href="/logout" className="inline-flex rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">
              Выйти
            </a>
            <a href="/partner-interactions" className="inline-flex rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">
              Взаимодействия партнёров
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1440px] gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Объекты организации", objects.length],
          ["В общей витрине", sharedObjects.length],
          ["Публичные", publicObjects.length],
          ["Рынки", markets.size],
          ["Без медиа", missingMedia.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-kv-line bg-white p-4">
            <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">{label}</div>
            <div className="mt-2 text-[30px] font-black text-kv-navy">{value}</div>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-[1440px] px-6 pb-6">
        <details className="rounded-md border border-kv-line bg-white">
          <summary className="cursor-pointer px-5 py-4 text-lg font-black text-kv-navy">Добавить новый объект</summary>

          {/* Drive intake block */}
          <div className="border-t border-kv-line bg-kv-bg p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">📁</span>
              <div>
                <div className="text-[13px] font-black text-kv-navy">Заполнить карточку из Google Drive</div>
                <div className="text-[12px] text-kv-muted">Загрузите фото, PDF и документы в папку Drive — AI заполнит карточку автоматически</div>
              </div>
            </div>
            <form action={fillFromDriveAction} className="flex gap-2">
              <input type="hidden" name="organizationSlug" value={organizationSlug} />
              <input
                name="driveFolderUrl"
                type="url"
                placeholder="https://drive.google.com/drive/folders/..."
                className="h-10 flex-1 rounded-md border border-kv-line bg-white px-3 text-[13px] text-kv-ink"
                required
              />
              <button type="submit" className="rounded-full bg-kv-navy px-5 py-2.5 text-[13px] font-black text-white whitespace-nowrap">
                ✦ Заполнить карточку
              </button>
            </form>
            <div className="mt-2 text-[11px] text-kv-muted">
              Убедитесь что папка открыта для доступа по ссылке или расшарена на сервисный аккаунт.
            </div>
          </div>

          <form action={createObjectAction} className="border-t border-kv-line p-5">
          <input type="hidden" name="organizationSlug" value={organizationSlug} />
          <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-kv-navy">Добавить объект вручную</h2>
              <p className="mt-1 text-[13px] text-kv-muted">Карточка создаётся в PostgreSQL. Публикация в общей витрине включается только отдельным статусом и разрешением.</p>
            </div>
            <button type="submit" className="rounded-full bg-kv-red px-5 py-3 text-sm font-black text-white">Создать объект</button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-[13px] font-bold text-kv-muted">
              Офис
              <select name="officeSlug" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                {offices.map((office) => (
                  <option key={office.slug} value={office.slug}>{office.legalName}</option>
                ))}
              </select>
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Рынок
              <select name="marketSlug" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                {marketOptions.map((market) => (
                  <option key={market.slug} value={market.slug}>{market.city}, {market.country}</option>
                ))}
              </select>
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Тип
              <select name="assetClass" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue="land">
                {assetClasses.map((assetClass) => (
                  <option key={assetClass} value={assetClass}>{assetLabel(assetClass)}</option>
                ))}
              </select>
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Подтип
              <input name="assetSubtype" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" placeholder="например: участок ИЖС, склад" />
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              Название RU
              <input name="title" required className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              Название EN
              <input name="titleEn" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              Адрес/локация RU
              <input name="addressDisplay" required className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              Адрес/локация EN
              <input name="addressDisplayEn" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              Описание RU
              <textarea name="description" className="mt-1 min-h-[96px] w-full rounded-md border border-kv-line px-3 py-2 text-kv-ink" />
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              Описание EN
              <textarea name="descriptionEn" className="mt-1 min-h-[96px] w-full rounded-md border border-kv-line px-3 py-2 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Площадь, м²
              <input name="areaSqm" inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Земля, м²
              <input name="landAreaSqm" inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Здание, м²
              <input name="buildingAreaSqm" inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Кадастровый номер
              <input name="cadastralNumber" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Цена текстом RU
              <input name="priceDisplay" placeholder="По запросу" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Цена текстом EN
              <input name="priceDisplayEn" placeholder="On request" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Сумма
              <input name="priceAmount" inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Валюта
              <select name="priceCurrency" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue="RUB">
                {["RUB", "USD", "EUR", "GEL", "AMD", "AED"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              Теги RU через запятую
              <input name="tags" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              Теги EN через запятую
              <input name="tagsEn" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="md:col-span-2 text-[13px] font-bold text-kv-muted">
              URL изображения
              <input name="mediaUrl" placeholder="/images/object.jpg или https://..." className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <div className="flex items-end gap-4">
              <label className="text-[13px] font-bold text-kv-muted">
                Статус
                <select name="status" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue="draft">
                  <option value="draft">Черновик</option>
                  <option value="published">Опубликован</option>
                </select>
              </label>
              <label className="text-[13px] font-bold text-kv-muted">
                Видимость
                <select name="visibility" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue="private">
                  <option value="private">Приватно</option>
                  <option value="office_network">Сеть офисов</option>
                  <option value="public">Публично</option>
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-[13px] font-bold text-kv-muted">
                <input name="canBeShownByOtherOffices" type="checkbox" />
                Общая витрина
              </label>
            </div>
          </div>
          </form>
        </details>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-4 px-6 pb-6 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-md border border-kv-line bg-white">
          <div className="border-b border-kv-line px-4 py-3">
            <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">AI-досье объектов</div>
            <h2 className="mt-1 text-lg font-black text-kv-navy">Объекты</h2>
          </div>
          <div className="max-h-[760px] divide-y divide-kv-line overflow-auto">
            {objects.map((object) => (
              <a
                key={object.id}
                href={`/?objectId=${encodeURIComponent(object.id)}&tab=${encodeURIComponent(selectedTab)}`}
                className={`block p-4 ${selectedObject?.id === object.id ? "bg-kv-bg" : "bg-white hover:bg-kv-bg"}`}
              >
                <div className="flex gap-3">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md border border-kv-line bg-kv-bg">
                    {resolveMediaUrl(object.media[0]?.url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveMediaUrl(object.media[0]?.url) ?? ""} alt={object.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-[10px] font-bold text-kv-muted">Нет фото</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-black text-kv-navy">{object.title}</div>
                    <div className="mt-1 text-[12px] text-kv-muted">{object.market.city}, {object.market.country}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge tone={object.documentCompleteness.missingCount ? "warn" : "good"}>docs {object.documentCompleteness.score}%</Badge>
                      <Badge tone={object.aiDossier ? "good" : "warn"}>{object.aiDossier ? "AI ok" : "AI нет"}</Badge>
                      <Badge>{object.documents.length} файлов</Badge>
                      {object.identity ? <Badge tone="good">IREPN {object.identity.status}</Badge> : <Badge>legacy</Badge>}
                    </div>
                  </div>
                </div>
              </a>
            ))}
            {!objects.length ? <div className="p-4 text-[13px] text-kv-muted">Объекты не загружены.</div> : null}
          </div>
        </aside>

        <section className="rounded-md border border-kv-line bg-white">
          {selectedObject ? (
            <>
              <div className="border-b border-kv-line px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={selectedObject.status === "published" ? "good" : "warn"}>{selectedObject.status}</Badge>
                      <Badge>{selectedObject.visibility}</Badge>
                      <Badge tone={selectedObject.documentCompleteness.missingCount ? "warn" : "good"}>
                        документы {selectedObject.documentCompleteness.presentCount}/{selectedObject.documentCompleteness.requiredCount}
                      </Badge>
                      <Badge tone={selectedObject.aiDossier ? "good" : "warn"}>{selectedObject.aiDossier ? "AI-анализ готов" : "AI-анализ не запускался"}</Badge>
                    </div>
                    <h2 className="mt-3 text-2xl font-black leading-tight text-kv-navy">{selectedObject.title}</h2>
                    <p className="mt-2 max-w-4xl text-[14px] leading-6 text-kv-muted">{selectedObject.addressDisplay ?? "Адрес не заполнен."}</p>
                  </div>
                  <form action={syncObjectDriveAction} className="grid min-w-[320px] gap-2 rounded-md border border-kv-line bg-kv-bg p-3">
                    <input type="hidden" name="objectId" value={selectedObject.id} />
                    <label className="text-[12px] font-black text-kv-muted">
                      Папка Google Drive для документов
                      <input
                        name="driveFolderUrl"
                        type="url"
                        defaultValue={selectedObject.driveIntakeFolderUrl ?? ""}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="mt-1 h-10 w-full rounded-md border border-kv-line bg-white px-3 text-[13px] text-kv-ink"
                        required
                      />
                    </label>
                    <button className="rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">
                      Синхронизировать документы и AI
                    </button>
                  </form>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-kv-line px-5 py-3">
                {dossierTabs.map(([id, label]) => (
                  <a
                    key={id}
                    href={`/?objectId=${encodeURIComponent(selectedObject.id)}&tab=${encodeURIComponent(id)}`}
                    className={`rounded-full px-4 py-2 text-[12px] font-black ${selectedTab === id ? "bg-kv-navy text-white" : "border border-kv-line bg-white text-kv-navy"}`}
                  >
                    {label}
                  </a>
                ))}
              </div>

              <div className="p-5">
                {selectedTab === "summary" ? (
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-md border border-kv-line bg-kv-bg p-4">
                      <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">AI-сводка</div>
                      <p className="mt-3 text-[15px] leading-6 text-kv-ink">
                        {summaryText(selectedObject.aiDossier?.summary) || "Сводка появится после синхронизации документов из Google Drive."}
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {[
                          ["Что известно", asStringList((selectedObject.aiDossier?.summary as { known?: unknown } | undefined)?.known)],
                          ["Что подтверждено", asStringList((selectedObject.aiDossier?.summary as { confirmed?: unknown } | undefined)?.confirmed)],
                          ["Что вызывает вопросы", asStringList((selectedObject.aiDossier?.summary as { questions?: unknown } | undefined)?.questions)],
                          ["Что сделать дальше", asStringList((selectedObject.aiDossier?.summary as { nextActions?: unknown } | undefined)?.nextActions)],
                        ].map(([title, items]) => (
                          <div key={String(title)} className="rounded-md border border-kv-line bg-white p-3">
                            <div className="font-black text-kv-navy">{title}</div>
                            {Array.isArray(items) && items.length ? (
                              <ul className="mt-2 space-y-1 text-[13px] text-kv-muted">
                                {items.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}
                              </ul>
                            ) : <div className="mt-2 text-[13px] text-kv-muted">Нет данных.</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border border-kv-line bg-white p-4">
                      <div className="font-black text-kv-navy">Комплектность документов</div>
                      <div className="mt-3 text-[36px] font-black text-kv-navy">{selectedObject.documentCompleteness.score}%</div>
                      <div className="mt-3 space-y-2">
                        {selectedObject.documentCompleteness.required.map((item) => (
                          <div key={item.type} className="flex items-center justify-between gap-3 rounded-md border border-kv-line bg-kv-bg px-3 py-2 text-[13px]">
                            <span className="font-bold text-kv-ink">{item.label}</span>
                            <Badge tone={item.status === "present" ? "good" : "warn"}>{item.status === "present" ? "есть" : "не хватает"}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedTab === "description" ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {[
                      ["Описание", selectedObject.description ?? "Описание не заполнено."],
                      ["Тип", selectedObject.assetSubtype ?? assetLabel(selectedObject.assetClass)],
                      ["Площадь", formatArea(selectedObject)],
                      ["Цена", selectedObject.priceDisplay ?? "По запросу"],
                      ["Кадастровый номер", selectedObject.cadastralNumber ?? "Не указан"],
                      ["Правообладатель информации", selectedObject.informationRightsHolder.organizationName],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-kv-line bg-kv-bg p-4">
                        <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">{label}</div>
                        <div className="mt-2 text-[14px] font-bold leading-6 text-kv-ink">{value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedTab === "documents" ? (
                  <div className="space-y-3">
                    {selectedObject.documents.map((document) => (
                      <div key={document.id} className="grid gap-3 rounded-md border border-kv-line bg-kv-bg p-4 lg:grid-cols-[1fr_160px_180px_180px]">
                        <div>
                          <div className="font-black text-kv-navy">{document.label}</div>
                          <div className="mt-1 text-[13px] text-kv-muted">{document.originalFileName ?? document.title}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge>{document.source}</Badge>
                            <Badge>v{document.currentVersion}</Badge>
                            <Badge tone={document.analysisStatus === "analyzed" ? "good" : "warn"}>{document.analysisStatus}</Badge>
                          </div>
                        </div>
                        <div className="text-[13px] text-kv-muted">
                          <span className="block font-black text-kv-ink">Размер</span>
                          {formatFileSize(document.sizeBytes)}
                        </div>
                        <div className="text-[13px] text-kv-muted">
                          <span className="block font-black text-kv-ink">Обновлено</span>
                          {new Date(document.updatedAt).toLocaleString("ru-RU")}
                        </div>
                        <div className="flex flex-wrap items-start gap-2">
                          <a href={document.url} className="rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">Скачать</a>
                          {document.driveWebUrl ? <a href={document.driveWebUrl} target="_blank" rel="noreferrer" className="rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">Drive</a> : null}
                          <form action={deleteDocumentAction}>
                            <input type="hidden" name="documentId" value={document.id} />
                            <button className="rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-red">Удалить</button>
                          </form>
                        </div>
                        {asStringList(document.aiRecommendations).length ? (
                          <div className="text-[13px] text-kv-muted lg:col-span-4">
                            <span className="font-black text-kv-ink">AI-рекомендации: </span>
                            {asStringList(document.aiRecommendations).join("; ")}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {!selectedObject.documents.length ? <div className="rounded-md border border-kv-line bg-kv-bg p-4 text-kv-muted">Документы еще не импортированы из Drive.</div> : null}
                  </div>
                ) : null}

                {selectedTab === "ai" ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[
                      ["Риски", selectedObject.aiDossier?.risks],
                      ["Конфликты", selectedObject.aiDossier?.conflicts],
                      ["Недостающие документы", selectedObject.aiDossier?.missingDocuments],
                      ["Рекомендации", selectedObject.aiDossier?.recommendations],
                    ].map(([title, value]) => (
                      <div key={String(title)} className="rounded-md border border-kv-line bg-kv-bg p-4">
                        <div className="font-black text-kv-navy">{String(title)}</div>
                        {asStringList(value).length ? (
                          <ul className="mt-3 space-y-2 text-[13px] text-kv-muted">
                            {asStringList(value).map((item) => <li key={item}>• {item}</li>)}
                          </ul>
                        ) : <div className="mt-3 text-[13px] text-kv-muted">Нет данных.</div>}
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedTab === "changes" ? (
                  <div className="space-y-4">
                    <div className="rounded-md border border-kv-line bg-kv-bg p-4">
                      <div className="font-black text-kv-navy">Что изменилось в документах</div>
                      {asStringList(selectedObject.aiDossier?.changeLog).length ? (
                        <ul className="mt-3 space-y-2 text-[13px] text-kv-muted">
                          {asStringList(selectedObject.aiDossier?.changeLog).map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      ) : <div className="mt-3 text-[13px] text-kv-muted">Изменений не найдено или анализ еще не выполнялся.</div>}
                    </div>
                    <div className="rounded-md border border-kv-line bg-white">
                      <div className="border-b border-kv-line px-4 py-3 font-black text-kv-navy">Предложения AI к карточке</div>
                      <div className="divide-y divide-kv-line">
                        {(selectedObject.aiDossier?.proposals ?? []).map((proposal) => (
                          <div key={proposal.id} className="grid gap-3 p-4 lg:grid-cols-[180px_1fr_1fr_220px]">
                            <div>
                              <div className="font-black text-kv-navy">{proposal.fieldPath}</div>
                              <Badge>{proposal.confidence}</Badge>
                            </div>
                            <div className="text-[13px] text-kv-muted">
                              <span className="block font-black text-kv-ink">Сейчас</span>
                              {fieldValue(proposal.currentValue)}
                            </div>
                            <div className="text-[13px] text-kv-muted">
                              <span className="block font-black text-kv-ink">Предложение AI</span>
                              {fieldValue(proposal.proposedValue)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <form action={reviewAIProposalAction}>
                                <input type="hidden" name="objectId" value={selectedObject.id} />
                                <input type="hidden" name="proposalId" value={proposal.id} />
                                <input type="hidden" name="proposalAction" value="accept" />
                                <button className="rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-black text-white">Принять</button>
                              </form>
                              <form action={reviewAIProposalAction}>
                                <input type="hidden" name="objectId" value={selectedObject.id} />
                                <input type="hidden" name="proposalId" value={proposal.id} />
                                <input type="hidden" name="proposalAction" value="reject" />
                                <button className="rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">Отклонить</button>
                              </form>
                            </div>
                            {proposal.rationale ? <div className="text-[13px] text-kv-muted lg:col-span-4">{proposal.rationale}</div> : null}
                          </div>
                        ))}
                        {!selectedObject.aiDossier?.proposals.length ? <div className="p-4 text-[13px] text-kv-muted">Нет ожидающих предложений AI.</div> : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedTab === "media" ? (
                  <div>
                    <MediaUploadForm objectId={selectedObject.id} />
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {selectedObject.media.map((media) => (
                        <div key={media.id} className="rounded-md border border-kv-line bg-kv-bg p-3">
                          <div className="h-[140px] overflow-hidden rounded-md border border-kv-line bg-white">
                            {resolveMediaUrl(media.url) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={resolveMediaUrl(media.url) ?? ""} alt={media.title ?? selectedObject.title} className="h-full w-full object-cover" />
                            ) : <div className="grid h-full place-items-center text-[12px] text-kv-muted">Нет изображения</div>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge>{media.kind}</Badge>
                            <Badge tone={media.public ? "good" : "warn"}>{media.public ? "public" : "private"}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedTab === "publication" ? (
                  <form action={updateObjectAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input type="hidden" name="organizationSlug" value={organizationSlug} />
                    <input type="hidden" name="objectId" value={selectedObject.id} />
                    <input type="hidden" name="title" value={selectedObject.title} />
                    <input type="hidden" name="description" value={selectedObject.description ?? ""} />
                    <input type="hidden" name="addressDisplay" value={selectedObject.addressDisplay ?? ""} />
                    <input type="hidden" name="assetClass" value={selectedObject.assetClass} />
                    <input type="hidden" name="marketSlug" value={selectedObject.market.slug} />
                    <label className="text-[13px] font-bold text-kv-muted">
                      Статус
                      <select name="status" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue={selectedObject.status}>
                        <option value="draft">Черновик</option>
                        <option value="published">Опубликован</option>
                        <option value="archived">Архив</option>
                      </select>
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Видимость
                      <select name="visibility" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue={selectedObject.visibility}>
                        <option value="private">Приватно</option>
                        <option value="office_network">Сеть офисов</option>
                        <option value="public">Публично</option>
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-[13px] font-bold text-kv-muted">
                      <input name="canBeShownByOtherOffices" type="checkbox" defaultChecked={selectedObject.canBeShownByOtherOffices} />
                      Общая витрина
                    </label>
                    <div className="flex items-end">
                      <button name="action" value="save" className="rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Сохранить публикацию</button>
                    </div>
                  </form>
                ) : null}
              </div>
            </>
          ) : (
            <div className="p-5 text-kv-muted">Выберите объект для просмотра досье.</div>
          )}
        </section>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-5 px-6 pb-6 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-5">
          <div className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-4 py-3">
              <h2 className="font-black text-kv-navy">Офисы</h2>
            </div>
            <div className="space-y-3 p-4">
              {(organization?.offices ?? []).map((office) => (
                <div key={office.slug} className="rounded-md border border-kv-line bg-kv-bg p-3">
                  <div className="font-black text-kv-navy">{office.legalName}</div>
                  <div className="mt-1 text-[13px] text-kv-muted">
                    {office.city}, {office.country}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="good">{office.status}</Badge>
                    <Badge>{office.counts.propertyObjects} объектов</Badge>
                  </div>
                </div>
              ))}
              {!organization?.offices.length ? <div className="text-[14px] text-kv-muted">Контекст организации не загружен.</div> : null}
            </div>
          </div>

          <form action={updateAccessSettingsAction} className="rounded-md border border-kv-line bg-white p-4">
            <h2 className="font-black text-kv-navy">Доступ к витрине</h2>
            <p className="mt-2 text-[13px] leading-5 text-kv-muted">
              Организация может скрыть объекты других партнеров на своем сайте. Собственные опубликованные объекты остаются в управлении организации.
            </p>
            <input type="hidden" name="organizationSlug" value={organizationSlug} />
            <label className="mt-4 flex items-start gap-3 rounded-md border border-kv-line bg-kv-bg p-3 text-[13px] font-bold text-kv-muted">
              <input name="showPartnerObjects" type="checkbox" defaultChecked={showPartnerObjects} className="mt-1" />
              <span>Показывать объекты других партнеров из общего опубликованного пула</span>
            </label>
            <button className="mt-4 rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Сохранить правило</button>
          </form>

          <div className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-4 py-3">
              <h2 className="font-black text-kv-navy">Пользователи организации</h2>
            </div>
            <div className="space-y-3 p-4">
              {members.map((member) => (
                <div key={member.id} className="rounded-md border border-kv-line bg-kv-bg p-3">
                  <div className="font-black text-kv-navy">{member.displayName ?? member.email}</div>
                  <div className="mt-1 text-[13px] text-kv-muted">{member.email}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {member.roles.map((role) => <Badge key={role}>{role}</Badge>)}
                    <Badge tone={member.active ? "good" : "warn"}>{member.active ? "active" : "inactive"}</Badge>
                  </div>
                </div>
              ))}
              {!members.length ? <div className="text-[14px] text-kv-muted">Пользователи еще не заведены.</div> : null}
            </div>
          </div>

          <details className="rounded-md border border-kv-line bg-white">
            <summary className="cursor-pointer px-4 py-3 font-black text-kv-navy">Добавить сотрудника</summary>
            <form action={createMemberAction} className="grid gap-3 border-t border-kv-line p-4">
              <input type="hidden" name="organizationSlug" value={organizationSlug} />
              <label className="text-[13px] font-bold text-kv-muted">
                Email
                <input name="email" required type="email" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
              </label>
              <label className="text-[13px] font-bold text-kv-muted">
                Имя
                <input name="displayName" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
              </label>
              <label className="text-[13px] font-bold text-kv-muted">
                Роль в организации
                <select name="organizationRole" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue="organization_admin">
                  <option value="organization_owner">Собственник организации</option>
                  <option value="organization_admin">Администратор организации</option>
                </select>
              </label>
              <label className="text-[13px] font-bold text-kv-muted">
                Офис
                <select name="officeSlug" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                  <option value="">Без привязки к офису</option>
                  {offices.map((office) => (
                    <option key={office.slug} value={office.slug}>{office.legalName}</option>
                  ))}
                </select>
              </label>
              <label className="text-[13px] font-bold text-kv-muted">
                Роль в офисе
                <select name="officeRole" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue="">
                  <option value="">Не назначать</option>
                  <option value="office_owner">Собственник офиса</option>
                  <option value="office_admin">Администратор офиса</option>
                  <option value="broker">Брокер</option>
                  <option value="office_analyst">Аналитик</option>
                  <option value="office_viewer">Просмотр</option>
                </select>
              </label>
              <button className="rounded-full bg-kv-red px-5 py-3 text-sm font-black text-white">Выдать доступ</button>
            </form>
          </details>

          <div className="rounded-md border border-kv-line bg-white p-4">
            <h2 className="font-black text-kv-navy">Правила доступа</h2>
            <div className="mt-3 space-y-3 text-[13px] leading-5 text-kv-muted">
              <p>Организация видит свои объекты и объекты общей витрины.</p>
              <p>Другие организации не получают приватные данные этой организации без разрешения правообладателя информации.</p>
              <p>Публикация в общей витрине включается через статус объекта и разрешение правообладателя информации.</p>
            </div>
          </div>
          <div className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-4 py-3">
              <h2 className="font-black text-kv-navy">Объекты партнеров на сайте</h2>
              <p className="mt-1 text-[13px] text-kv-muted">
                Видимые: {visiblePartnerObjects.length}. Скрытые: {hiddenPartnerObjects.length}.
              </p>
            </div>
            <div className="max-h-[520px] space-y-3 overflow-y-auto p-4">
              {partnerObjects.map((object) => (
                <div key={object.id} className="rounded-md border border-kv-line bg-kv-bg p-3">
                  <div className="font-black text-kv-navy">{object.title}</div>
                  <div className="mt-1 text-[13px] text-kv-muted">
                    {object.sellerSide.organizationName} · {object.market.city}, {object.market.country}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={object.hiddenOnThisSite ? "warn" : "good"}>
                      {object.hiddenOnThisSite ? "скрыт на сайте" : "показывается"}
                    </Badge>
                    <Badge>{object.assetClass}</Badge>
                  </div>
                  <form action={updatePartnerObjectVisibilityAction} className="mt-3">
                    <input type="hidden" name="organizationSlug" value={organizationSlug} />
                    <input type="hidden" name="propertyObjectId" value={object.id} />
                    {object.hiddenOnThisSite ? (
                      <button name="hidden" value="false" className="rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">
                        Вернуть на сайт
                      </button>
                    ) : (
                      <button name="hidden" value="true" className="rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">
                        Скрыть на сайте
                      </button>
                    )}
                  </form>
                </div>
              ))}
              {!partnerObjects.length ? <div className="text-[14px] text-kv-muted">Партнерских объектов в общей витрине пока нет.</div> : null}
            </div>
          </div>
        </aside>

        <section className="rounded-md border border-kv-line bg-white">
          <div className="flex flex-col gap-3 border-b border-kv-line px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-kv-navy">Объекты организации</h2>
              <p className="mt-1 text-[13px] text-kv-muted">Данные загружаются из PostgreSQL через защищенный Cloud Run API.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="good">media ok: {objects.length - missingMedia.length}</Badge>
              <Badge tone={missingMedia.length ? "warn" : "good"}>без media: {missingMedia.length}</Badge>
            </div>
          </div>

          {/* AI Draft objects from Drive intake */}
          {objects.filter((o) => o.driveIntakePending).map((object) => (
            <div key={object.id} className="border-b border-kv-line bg-amber-50 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-white">✦ AI черновик</span>
                {object.driveIntakeConfidence !== null && (
                  <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700">
                    Уверенность: {Math.round((object.driveIntakeConfidence ?? 0) * 100)}%
                  </span>
                )}
                {object.driveIntakeFolderUrl && (
                  <a href={object.driveIntakeFolderUrl} target="_blank" rel="noreferrer" className="text-[11px] text-kv-muted underline">
                    📁 Папка Drive
                  </a>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-[160px_1fr_250px]">
                <div className="h-[112px] overflow-hidden rounded-md border border-kv-line bg-kv-bg">
                  {resolveMediaUrl(object.media[0]?.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveMediaUrl(object.media[0]?.url) ?? ""} alt={object.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center px-3 text-center text-[12px] font-bold text-kv-muted">Фото загружается...</div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black leading-tight text-kv-navy">{object.title}</h3>
                  <p className="mt-1 text-[13px] text-kv-muted">{object.description ?? "Описание заполнено AI"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-kv-muted">
                    <span>{object.market?.city}, {object.market?.country}</span>
                    <span>·</span>
                    <span>{object.assetClass}</span>
                    {object.mediaCount > 0 && <><span>·</span><span>{object.mediaCount} фото</span></>}
                  </div>
                </div>
                <div className="space-y-2">
                  <details className="rounded-md border border-amber-200 bg-white">
                    <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-kv-navy">Редактировать и опубликовать</summary>
                    <form action={updateObjectAction} className="space-y-2 border-t border-kv-line p-3">
                      <input type="hidden" name="organizationSlug" value={organizationSlug} />
                      <input type="hidden" name="objectId" value={object.id} />
                      <input name="title" defaultValue={object.title} className="h-9 w-full rounded border border-kv-line px-2 text-[12px] text-kv-ink" />
                      <select name="status" className="h-9 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink" defaultValue="published">
                        <option value="draft">Черновик</option>
                        <option value="published">Опубликовать</option>
                      </select>
                      <select name="visibility" className="h-9 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink" defaultValue="public">
                        <option value="private">Приватно</option>
                        <option value="public">Публично</option>
                      </select>
                      <label className="flex items-center gap-2 text-[12px] text-kv-muted">
                        <input name="canBeShownByOtherOffices" type="checkbox" defaultChecked />
                        В общей витрине
                      </label>
                      <div className="flex gap-2">
                        <button name="action" value="publish" className="flex-1 rounded-full bg-emerald-600 py-2 text-[12px] font-black text-white">Опубликовать</button>
                        <button name="action" value="archive" className="rounded-full border border-kv-line px-3 py-2 text-[12px] font-black text-kv-muted">Удалить</button>
                      </div>
                    </form>
                  </details>
                </div>
              </div>
            </div>
          ))}

          <div className="divide-y divide-kv-line">
            {objects.filter((o) => !o.driveIntakePending).map((object) => (
              <article key={object.id} className="grid gap-4 p-4 lg:grid-cols-[160px_1fr_250px]">
                <div className="h-[112px] overflow-hidden rounded-md border border-kv-line bg-kv-bg">
                  {resolveMediaUrl(object.media[0]?.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveMediaUrl(object.media[0]?.url) ?? ""} alt={object.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center px-3 text-center text-[12px] font-bold text-kv-muted">Нет изображения</div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={object.status === "published" ? "good" : "warn"}>{object.status}</Badge>
                    <Badge>{object.visibility}</Badge>
                    <Badge tone={object.canBeShownByOtherOffices ? "good" : "neutral"}>
                      {object.canBeShownByOtherOffices ? "общая витрина" : "только организация"}
                    </Badge>
                    {object.identity ? <Badge tone="good">IREPN {object.identity.stableId}</Badge> : <Badge>legacy</Badge>}
                    {object.identity?.representationStatus ? <Badge tone={object.identity.representationStatus === "VERIFIED" ? "good" : "warn"}>право: {object.identity.representationStatus}</Badge> : null}
                  </div>
                  <h3 className="mt-3 text-lg font-black leading-tight text-kv-navy">{object.title}</h3>
                  <p className="mt-2 max-w-3xl text-[14px] leading-5 text-kv-muted">{object.description ?? "Описание не заполнено."}</p>
                  <div className="mt-3 grid gap-2 text-[13px] text-kv-muted md:grid-cols-3">
                    <div>
                      <span className="block font-black text-kv-ink">Тип</span>
                      {object.assetSubtype ?? assetLabel(object.assetClass)}
                    </div>
                    <div>
                      <span className="block font-black text-kv-ink">Рынок</span>
                      {object.market.city}, {object.market.country}
                    </div>
                    <div>
                      <span className="block font-black text-kv-ink">Площадь</span>
                      {formatArea(object)}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-kv-line bg-kv-bg p-3 text-[13px]">
                  <div className="font-black text-kv-navy">Права и контроль</div>
                  <dl className="mt-3 space-y-2 text-kv-muted">
                    <div>
                      <dt className="font-black text-kv-ink">Сторона продавца</dt>
                      <dd>{object.sellerSide.organizationName}</dd>
                    </div>
                    <div>
                      <dt className="font-black text-kv-ink">Правообладатель информации</dt>
                      <dd>{object.informationRightsHolder.organizationName}</dd>
                    </div>
                    <div>
                      <dt className="font-black text-kv-ink">Обновлено</dt>
                      <dd>{new Date(object.updatedAt).toLocaleDateString("ru-RU")}</dd>
                    </div>
                  </dl>
                </div>

                <details className="rounded-md border border-kv-line bg-white lg:col-span-3">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-black text-kv-navy">Редактировать карточку, публикацию и медиа</summary>
                  <div className="border-t border-kv-line p-4">
                    <MediaUploadForm objectId={object.id} />
                    {object.media.length ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {object.media.map((media, index) => (
                          <div key={media.id} className="rounded-md border border-kv-line bg-white p-3">
                            <div className="h-[120px] overflow-hidden rounded-md border border-kv-line bg-kv-bg">
                              {resolveMediaUrl(media.url) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={resolveMediaUrl(media.url) ?? ""} alt={media.title ?? object.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="grid h-full place-items-center px-3 text-center text-[12px] font-bold text-kv-muted">Нет изображения</div>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge tone={index === 0 || media.sortOrder === 0 ? "good" : "neutral"}>
                                {index === 0 || media.sortOrder === 0 ? "главная" : "медиа"}
                              </Badge>
                              <Badge tone={media.public ? "good" : "warn"}>{media.public ? "публичная" : "приватная"}</Badge>
                              <Badge>{media.kind}</Badge>
                            </div>
                            {media.caption || media.title ? (
                              <div className="mt-2 text-[12px] font-bold text-kv-muted">{media.title ?? media.caption}</div>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <form action={setCoverMediaAction}>
                                <input type="hidden" name="mediaId" value={media.id} />
                                <button className="rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">
                                  Сделать главной
                                </button>
                              </form>
                              <form action={deleteMediaAction}>
                                <input type="hidden" name="mediaId" value={media.id} />
                                <button className="rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-red">
                                  Удалить
                                </button>
                              </form>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <form action={updateObjectAction} className="grid gap-3 border-t border-kv-line p-4 md:grid-cols-2 xl:grid-cols-4">
                    <input type="hidden" name="organizationSlug" value={organizationSlug} />
                    <input type="hidden" name="objectId" value={object.id} />
                    <label className="text-[13px] font-bold text-kv-muted">
                      Рынок
                      <select name="marketSlug" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue={object.market.slug}>
                        {marketOptions.map((market) => (
                          <option key={market.slug} value={market.slug}>{market.city}, {market.country}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Тип
                      <select name="assetClass" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue={object.assetClass}>
                        {assetClasses.map((assetClass) => (
                          <option key={assetClass} value={assetClass}>{assetLabel(assetClass)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Статус
                      <select name="status" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue={object.status}>
                        <option value="draft">Черновик</option>
                        <option value="published">Опубликован</option>
                        <option value="archived">Архив</option>
                      </select>
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Видимость
                      <select name="visibility" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue={object.visibility}>
                        <option value="private">Приватно</option>
                        <option value="office_network">Сеть офисов</option>
                        <option value="public">Публично</option>
                      </select>
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Название RU
                      <input name="title" required defaultValue={object.title} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Название EN
                      <input name="titleEn" defaultValue={object.titleEn ?? ""} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Адрес/локация RU
                      <input name="addressDisplay" required defaultValue={object.addressDisplay ?? ""} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Адрес/локация EN
                      <input name="addressDisplayEn" defaultValue={object.addressDisplayEn ?? ""} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Описание RU
                      <textarea name="description" defaultValue={object.description ?? ""} className="mt-1 min-h-[96px] w-full rounded-md border border-kv-line px-3 py-2 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Описание EN
                      <textarea name="descriptionEn" defaultValue={object.descriptionEn ?? ""} className="mt-1 min-h-[96px] w-full rounded-md border border-kv-line px-3 py-2 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Подтип
                      <input name="assetSubtype" defaultValue={object.assetSubtype ?? ""} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Площадь, м²
                      <input name="areaSqm" defaultValue={object.areaSqm ?? ""} inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Земля, м²
                      <input name="landAreaSqm" defaultValue={object.landAreaSqm ?? ""} inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Здание, м²
                      <input name="buildingAreaSqm" defaultValue={object.buildingAreaSqm ?? ""} inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Цена текстом RU
                      <input name="priceDisplay" defaultValue={object.priceDisplay ?? ""} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Цена текстом EN
                      <input name="priceDisplayEn" defaultValue={object.priceDisplayEn ?? ""} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Сумма
                      <input name="priceAmount" inputMode="decimal" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted">
                      Валюта
                      <select name="priceCurrency" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue={object.priceCurrency ?? "RUB"}>
                        {["RUB", "USD", "EUR", "GEL", "AMD", "AED"].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                      </select>
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Теги RU через запятую
                      <input name="tags" defaultValue={object.tags.join(", ")} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Теги EN через запятую
                      <input name="tagsEn" defaultValue={object.tagsEn.join(", ")} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                      Новый URL изображения
                      <input name="mediaUrl" placeholder={object.media[0]?.url ?? "/images/object.jpg"} className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                    </label>
                    <div className="flex flex-wrap items-end gap-4 md:col-span-2">
                      <label className="flex min-h-11 items-center gap-2 text-[13px] font-bold text-kv-muted">
                        <input name="canBeShownByOtherOffices" type="checkbox" defaultChecked={object.canBeShownByOtherOffices} />
                        Разрешить общую витрину
                      </label>
                      <label className="flex min-h-11 items-center gap-2 text-[13px] font-bold text-kv-muted">
                        <input name="clearMedia" type="checkbox" />
                        Очистить изображения
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-kv-line pt-4 md:col-span-2 xl:col-span-4">
                      <button name="action" value="save" className="rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Сохранить</button>
                      <button name="action" value="publish" className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white">Опубликовать в витрине</button>
                      <button name="action" value="unpublish" className="rounded-full bg-amber-600 px-5 py-3 text-sm font-black text-white">Снять с публикации</button>
                      <button name="action" value="archive" className="rounded-full border border-kv-line px-5 py-3 text-sm font-black text-kv-navy">В архив</button>
                    </div>
                  </form>
                </details>
              </article>
            ))}
            {!objects.filter((o) => !o.driveIntakePending).length ? <div className="p-5 text-kv-muted">Объекты не загружены.</div> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
