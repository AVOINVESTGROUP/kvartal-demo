import { fetchBackendJson } from "../lib/server-api";

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
    market: { city: string; country: string; slug: string };
    sellerSide: { officeName: string; organizationName: string };
    informationRightsHolder: { officeName: string; organizationName: string };
    media: Array<{ url: string; kind: string }>;
    mediaCount: number;
    publishedAt: string | null;
    updatedAt: string;
  }>;
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

export default async function KvartalAdminHome() {
  const organizationSlug = process.env.PARTNER_ORGANIZATION_SLUG ?? "kvartal-moscow";
  const [context, objectResponse] = await Promise.all([
    fetchBackendJson<AdminContextResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/context?organizationSlug=${encodeURIComponent(organizationSlug)}`,
    ),
    fetchBackendJson<AdminObjectsResponse>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/objects?organizationSlug=${encodeURIComponent(organizationSlug)}&language=ru&limit=100`,
    ),
  ]);

  const organization = context?.organization;
  const objects = objectResponse?.objects ?? [];
  const publicObjects = objects.filter((object) => object.status === "published" && object.visibility === "public");
  const sharedObjects = publicObjects.filter((object) => object.canBeShownByOtherOffices);
  const missingMedia = objects.filter((object) => object.mediaCount === 0);
  const markets = new Set(objects.map((object) => `${object.market.city}, ${object.market.country}`));

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
              </article>
            ))}
            {!objects.length ? <div className="p-5 text-kv-muted">Объекты не загружены.</div> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
