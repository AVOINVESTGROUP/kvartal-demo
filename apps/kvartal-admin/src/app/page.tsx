import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchBackendJson, writeBackendJson } from "../lib/server-api";

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
    titleEn: string | null;
    descriptionEn: string | null;
    addressDisplayEn: string | null;
    tags: string[];
    tagsEn: string[];
    priceDisplayEn: string | null;
    market: { city: string; country: string; slug: string };
    sellerSide: { officeName: string; organizationName: string };
    informationRightsHolder: { officeName: string; organizationName: string };
    media: Array<{ url: string; kind: string }>;
    mediaCount: number;
    publishedAt: string | null;
    updatedAt: string;
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

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const baseUrl = process.env.PUBLIC_SITE_BASE_URL ?? "https://kvartal-web-dev--kvartal-dev.europe-west4.hosted.app";

  return `${baseUrl}${url}`;
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

function formPayload(formData: FormData) {
  return {
    organizationSlug: formValue(formData, "organizationSlug"),
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

async function requireAdminSession() {
  const sessionToken = process.env.KVARTAL_ADMIN_SESSION_TOKEN;
  const cookieStore = await cookies();

  if (!sessionToken || cookieStore.get("kvartal_admin_session")?.value !== sessionToken) {
    redirect("/login");
  }
}

async function createObjectAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/objects", "POST", formPayload(formData));
  revalidatePath("/");
}

async function updateObjectAction(formData: FormData) {
  "use server";

  const objectId = formValue(formData, "objectId");
  const action = formValue(formData, "action") || "save";

  await requireAdminSession();
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/objects/${encodeURIComponent(objectId)}`, "PATCH", {
    ...formPayload(formData),
    action,
    clearMedia: formData.get("clearMedia") === "on",
  });
  revalidatePath("/");
}

async function updateAccessSettingsAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/access-settings", "PATCH", {
    organizationSlug: formValue(formData, "organizationSlug"),
    showPartnerObjects: formData.get("showPartnerObjects") === "on",
  });
  revalidatePath("/");
}

async function createMemberAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/members", "POST", {
    organizationSlug: formValue(formData, "organizationSlug"),
    email: formValue(formData, "email"),
    displayName: formValue(formData, "displayName"),
    organizationRole: formValue(formData, "organizationRole"),
    officeSlug: formValue(formData, "officeSlug"),
    officeRole: formValue(formData, "officeRole"),
  });
  revalidatePath("/");
}

export default async function KvartalAdminHome() {
  await requireAdminSession();

  const organizationSlug = process.env.PARTNER_ORGANIZATION_SLUG ?? "kvartal-moscow";
  const [context, objectResponse, reference] = await Promise.all([
    fetchBackendJson<AdminContextResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/context?organizationSlug=${encodeURIComponent(organizationSlug)}`,
    ),
    fetchBackendJson<AdminObjectsResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/objects?organizationSlug=${encodeURIComponent(organizationSlug)}&language=ru&limit=100`,
    ),
    fetchBackendJson<AdminReferenceResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/reference?organizationSlug=${encodeURIComponent(organizationSlug)}`,
    ),
  ]);

  const organization = context?.organization;
  const objects = objectResponse?.objects ?? [];
  const publicObjects = objects.filter((object) => object.status === "published" && object.visibility === "public");
  const sharedObjects = publicObjects.filter((object) => object.canBeShownByOtherOffices);
  const missingMedia = objects.filter((object) => object.mediaCount === 0);
  const markets = new Set(objects.map((object) => `${object.market.city}, ${object.market.country}`));
  const offices = reference?.offices ?? [];
  const marketOptions = reference?.markets ?? [];
  const assetClasses = reference?.assetClasses ?? ["land", "apartment", "house", "office", "industrial_site", "development_project"];
  const members = organization?.members ?? [];
  const showPartnerObjects = organization?.siteConfig.showPartnerObjects ?? true;

  return (
    <main className="min-h-screen bg-kv-bg text-kv-ink">
      <header className="border-b border-kv-line bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">KVARTAL Moscow admin</div>
            <h1 className="mt-2 text-[32px] font-black tracking-tight text-kv-navy">{organization?.legalName ?? "KVARTAL Moscow"}</h1>
            <p className="mt-2 max-w-[860px] text-[15px] leading-6 text-kv-muted">
              Рабочий кабинет организации: объекты, права на информацию, публикация в общей витрине и контроль качества карточек.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{organization?.status ?? "loading"}</Badge>
            <Badge>{organization?.countryOfRegistration ?? "RU"}</Badge>
            <Badge>{organization?.defaultCurrency ?? "RUB"}</Badge>
            <a href="/logout" className="inline-flex rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">
              Выйти
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
          <form action={createObjectAction} className="border-t border-kv-line p-5">
          <input type="hidden" name="organizationSlug" value={organizationSlug} />
          <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-kv-navy">Добавить объект</h2>
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
              <p>KVARTAL видит свои объекты и объекты общей витрины.</p>
              <p>Другие организации не получают приватные данные KVARTAL без разрешения правообладателя информации.</p>
              <p>Публикация в общей витрине требует: `published`, `public`, `canBeShownByOtherOffices`.</p>
            </div>
          </div>
        </aside>

        <section className="rounded-md border border-kv-line bg-white">
          <div className="flex flex-col gap-3 border-b border-kv-line px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-kv-navy">Объекты KVARTAL</h2>
              <p className="mt-1 text-[13px] text-kv-muted">Данные загружаются из PostgreSQL через защищенный Cloud Run API.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="good">media ok: {objects.length - missingMedia.length}</Badge>
              <Badge tone={missingMedia.length ? "warn" : "good"}>без media: {missingMedia.length}</Badge>
            </div>
          </div>

          <div className="divide-y divide-kv-line">
            {objects.map((object) => (
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
                      {object.canBeShownByOtherOffices ? "общая витрина" : "только KVARTAL"}
                    </Badge>
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
            {!objects.length ? <div className="p-5 text-kv-muted">Объекты не загружены.</div> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
