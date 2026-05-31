"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { SiteLanguage } from "./site-language";

export type ObjectItem = {
  id: string;
  title: string;
  titleEn?: string;
  type: string;
  typeLabel: string;
  typeLabelEn?: string;
  country: string;
  city: string;
  market: string;
  area?: number;
  areaDisplay: string;
  address: string;
  addressEn?: string;
  owner: string;
  description: string;
  descriptionEn?: string;
  imageUrl?: string;
  tags: string[];
  tagsEn?: string[];
};

export type MarketSnapshotIndicator = {
  category: "residential" | "commercial";
  label: string;
  value: number | null;
  currency: string;
  unit: string;
  confidence: string;
  updatedAt: string | null;
};

export type MarketSnapshotMarket = {
  id: string;
  slug: string;
  city: string;
  country: string;
  indicators: {
    residential?: MarketSnapshotIndicator;
    commercial?: MarketSnapshotIndicator;
  };
};

export type MarketSnapshot = {
  ok?: boolean;
  period?: string;
  updatedAt?: string | null;
  disclaimer?: string;
  homeMarket?: MarketSnapshotMarket | null;
  otherMarkets?: MarketSnapshotMarket[];
};

type ObjectsClientProps = {
  objects: ObjectItem[];
  language: SiteLanguage;
  marketSnapshot: MarketSnapshot | null;
};

function formatMarketValue(indicator?: MarketSnapshotIndicator) {
  if (!indicator || indicator.value === null) {
    return "—";
  }

  return `$${Math.round(indicator.value).toLocaleString("en-US")} / m²`;
}

function formatUpdatedAt(value: string | null | undefined, language: SiteLanguage) {
  if (!value) {
    return language === "en" ? "Monthly AI estimate" : "Ежемесячная AI-оценка";
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function MarketSnapshotWidget({ snapshot, language }: { snapshot: MarketSnapshot | null; language: SiteLanguage }) {
  const t = {
    ru: {
      kicker: "AI Market Snapshot",
      updated: "Обновлено",
      home: "Домашний рынок",
      other: "Другие рынки",
      residential: "Жилая",
      commercial: "Коммерч.",
      disclaimer: "Оценка AI, обновляется ежемесячно. Требуется проверка брокером.",
    },
    en: {
      kicker: "AI Market Snapshot",
      updated: "Updated",
      home: "Home market",
      other: "Other markets",
      residential: "Residential",
      commercial: "Commercial",
      disclaimer: "AI estimate, updated monthly. Broker verification required.",
    },
  }[language];
  const homeMarket = snapshot?.homeMarket;
  const otherMarkets = snapshot?.otherMarkets ?? [];

  return (
    <aside className="w-full rounded-kv-main border border-kv-line bg-white p-5 shadow-sm md:max-w-[380px]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] font-black uppercase tracking-widest text-kv-red">{t.kicker}</div>
          <div className="mt-1 text-[13px] text-kv-muted">
            {t.updated}: {formatUpdatedAt(snapshot?.updatedAt, language)}
          </div>
        </div>
        <span className="rounded-full bg-kv-bg px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-kv-navy">
          USD / m²
        </span>
      </div>

      <div className="rounded-kv-form border border-kv-line bg-kv-bg p-4">
        <div className="text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">{t.home}</div>
        <div className="mt-1 text-lg font-black text-kv-navy">
          {homeMarket ? `${homeMarket.city}, ${homeMarket.country}` : "Moscow, RU"}
        </div>
        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-kv-muted">{t.residential}</span>
            <strong className="text-kv-navy">{formatMarketValue(homeMarket?.indicators.residential)}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-kv-muted">{t.commercial}</span>
            <strong className="text-kv-navy">{formatMarketValue(homeMarket?.indicators.commercial)}</strong>
          </div>
        </div>
      </div>

      {otherMarkets.length ? (
        <div className="mt-4">
          <div className="mb-2 text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">{t.other}</div>
          <div className="space-y-2">
            {otherMarkets.map((market) => (
              <div key={market.id} className="grid grid-cols-[1fr,auto] gap-3 border-b border-kv-line pb-2 text-sm last:border-b-0 last:pb-0">
                <span className="font-bold text-kv-ink">{market.city}</span>
                <span className="text-kv-muted">{formatMarketValue(market.indicators.residential ?? market.indicators.commercial)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-[12px] leading-relaxed text-kv-muted">{snapshot?.disclaimer ?? t.disclaimer}</p>
    </aside>
  );
}

function tickerValue(indicator?: MarketSnapshotIndicator) {
  if (!indicator || indicator.value === null) {
    return null;
  }

  return `${Math.round(indicator.value).toLocaleString("en-US")} $/кв.м`;
}

function tickerIndicator(market?: MarketSnapshotMarket | null) {
  return market?.indicators.residential ?? market?.indicators.commercial;
}

function marketBaselineValue(market?: MarketSnapshotMarket | null) {
  if (!market) {
    return null;
  }

  const key = `${market.city.toLowerCase()}:${market.country.toUpperCase()}`;
  const baseline: Record<string, string> = {
    "new york:US": "9,960 $/кв.м",
    "los angeles:US": "6,860 $/кв.м",
    "dubai:AE": "5,880 $/кв.м",
    "moscow:RU": "2,900 $/кв.м",
    "yerevan:AM": "2,320 $/кв.м",
    "philadelphia:US": "2,260 $/кв.м",
    "tbilisi:GE": "1,660 $/кв.м",
    "bataysk:RU": "1,475 $/кв.м",
  };

  return baseline[key] ?? null;
}

function MarketSnapshotTicker({ snapshot, language }: { snapshot: MarketSnapshot | null; language: SiteLanguage }) {
  const labels =
    language === "en"
      ? { title: "AI market estimate", pending: "data pending", updated: "updated monthly" }
      : { title: "AI оценка рынка", pending: "данные уточняются", updated: "обновляется ежемесячно" };
  const homeMarket = snapshot?.homeMarket ?? null;
  const rotatingMarkets = snapshot?.otherMarkets ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (rotatingMarkets.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % rotatingMarkets.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, [rotatingMarkets.length]);

  const activeMarket = rotatingMarkets[activeIndex % Math.max(rotatingMarkets.length, 1)] ?? null;
  const homeValue = marketBaselineValue(homeMarket) ?? tickerValue(tickerIndicator(homeMarket)) ?? labels.pending;
  const activeValue = activeMarket ? marketBaselineValue(activeMarket) ?? tickerValue(tickerIndicator(activeMarket)) ?? labels.pending : labels.pending;

  return (
    <aside className="w-full lg:max-w-[420px]" aria-label={labels.title}>
      <div className="mb-2 flex max-w-[360px] items-center justify-between gap-3 text-[11px] font-black uppercase tracking-widest text-kv-red">
        <span>{labels.title}</span>
        <span className="text-kv-muted">{formatUpdatedAt(snapshot?.updatedAt, language)}</span>
      </div>
      <div className="inline-grid w-full max-w-[360px] grid-cols-[minmax(92px,0.55fr),1fr] overflow-hidden rounded-kv-form border border-kv-navy/24 bg-white text-sm shadow-sm">
        <div className="border-b border-r border-kv-navy/24 px-3 py-2 font-bold text-kv-navy">
          {homeMarket?.city ?? "Moscow"}
        </div>
        <div className="border-b border-kv-navy/24 px-3 py-2 font-semibold text-kv-ink">{homeValue}</div>
        <div key={`${activeMarket?.id ?? "empty"}-city`} className="border-r border-kv-navy/24 px-3 py-2 font-bold text-kv-navy">
          {activeMarket?.city ?? "-"}
        </div>
        <div key={`${activeMarket?.id ?? "empty"}-value`} className="px-3 py-2 font-semibold text-kv-ink">{activeValue}</div>
      </div>
      <div className="mt-2 max-w-[360px] text-[11px] leading-snug text-kv-muted">
        {labels.updated}. {language === "en" ? "Broker verification required." : "Требуется проверка брокером."}
      </div>
    </aside>
  );
}

export function ObjectsClient({ objects, language, marketSnapshot }: ObjectsClientProps) {
  const [type, setType] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  const t = {
    ru: {
      kicker: "Витрина объектов",
      title: "Общий опубликованный пул объектов по странам и городам",
      subtitle: "Это объекты, разрешенные к показу на сайтах партнеров в их собственном дизайне.",
      type: "Тип объекта",
      allTypes: "Все типы",
      country: "Страна",
      allCountries: "Все страны",
      city: "Город",
      allCities: "Все города",
      markets: "Рынки",
      find: "Найти",
      reset: "Сбросить",
      shown: "Показано объектов",
      source: "Источник: PostgreSQL / Cloud Run API",
      onRequest: "По запросу",
      address: "Адрес",
      area: "Площадь",
      seller: "Продавец",
      request: "Запросить",
      discuss: "Обсудить",
      empty: "По выбранным параметрам объектов нет. Измените страну, город или тип.",
    },
    en: {
      kicker: "Public inventory",
      title: "Shared published inventory by country and city",
      subtitle: "These are objects approved for display on partner websites in their own design.",
      type: "Object type",
      allTypes: "All types",
      country: "Country",
      allCountries: "All countries",
      city: "City",
      allCities: "All cities",
      markets: "Markets",
      find: "Find",
      reset: "Reset",
      shown: "Shown objects",
      source: "Source: PostgreSQL / Cloud Run API",
      onRequest: "On request",
      address: "Address",
      area: "Area",
      seller: "Seller",
      request: "Request",
      discuss: "Discuss",
      empty: "No objects match the selected country, city and type.",
    },
  }[language];

  const objectTypes = useMemo(() => {
    const byType = new Map<string, ObjectItem>();
    objects.forEach((item) => byType.set(item.type, item));
    return Array.from(byType.values()).sort((a, b) => a.type.localeCompare(b.type));
  }, [objects]);
  const countries = useMemo(() => Array.from(new Set(objects.map((item) => item.country))).sort(), [objects]);
  const cities = useMemo(
    () => Array.from(new Set(objects.filter((item) => country === "" || item.country === country).map((item) => item.city))).sort(),
    [country, objects],
  );

  const visibleObjects = useMemo(() => {
    return objects.filter((item) => {
      const matchesType = type === "" || item.type === type;
      const matchesCountry = country === "" || item.country === country;
      const matchesCity = city === "" || item.city === city;

      return matchesType && matchesCountry && matchesCity;
    });
  }, [city, country, objects, type]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const resetFilters = () => {
    setType("");
    setCountry("");
    setCity("");
  };

  return (
    <section id="objects" aria-labelledby="objects-title" className="bg-white py-14">
      <div className="mx-auto max-w-kv-container px-5">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">{t.kicker}</span>
            <h2 id="objects-title" className="max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">
              {t.title}
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-kv-muted">{t.subtitle}</p>
          </div>
          <MarketSnapshotTicker snapshot={marketSnapshot} language={language} />
        </div>

        <form id="object-filter" aria-label="Object filter" className="mb-5 rounded-kv-main border border-kv-line bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 items-end gap-3.5 md:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col">
              <label htmlFor="filter-type" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                {t.type}
              </label>
              <select
                id="filter-type"
                name="type"
                value={type}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">{t.allTypes}</option>
                {objectTypes.map((item) => (
                  <option key={item.type} value={item.type}>
                    {language === "en" ? item.typeLabelEn ?? item.typeLabel : item.typeLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="filter-country" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                {t.country}
              </label>
              <select
                id="filter-country"
                name="country"
                value={country}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => {
                  setCountry(event.target.value);
                  setCity("");
                }}
              >
                <option value="">{t.allCountries}</option>
                {countries.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="filter-city" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                {t.city}
              </label>
              <select
                id="filter-city"
                name="city"
                value={city}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setCity(event.target.value)}
              >
                <option value="">{t.allCities}</option>
                {cities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-kv-form border border-kv-line bg-kv-bg p-3">
              <div className="text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">{t.markets}</div>
              <div className="mt-1 text-lg font-black text-kv-navy">{countries.length}</div>
            </div>

            <div className="flex gap-2.5">
              <button type="submit" className="cursor-pointer rounded-full bg-kv-navy px-5 py-3 font-extrabold text-white transition-all hover:bg-kv-navy-light">
                {t.find}
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-full border border-kv-line bg-white px-5 py-3 font-extrabold text-kv-navy transition-all hover:bg-kv-bg-warm"
                onClick={resetFilters}
              >
                {t.reset}
              </button>
            </div>
          </div>
        </form>

        <div className="mb-4 flex flex-wrap justify-between gap-5 text-sm text-kv-muted">
          <span>{t.shown}: {visibleObjects.length}</span>
          <span>{t.source}</span>
        </div>

        <div id="objects-list" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleObjects.map((item) => (
            <article key={item.id} className="group overflow-hidden rounded-kv-main border border-kv-line bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl">
              <div className="relative h-52 overflow-hidden bg-kv-navy text-white">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-end bg-[linear-gradient(135deg,rgba(7,29,58,0.86),rgba(13,46,88,0.62)),repeating-linear-gradient(45deg,#98a6b5,#98a6b5_1px,#b9c2cc_1px,#b9c2cc_16px)] p-4 text-[13px] leading-snug text-white/80">
                    {language === "en" ? "Visual materials and documents are available on request." : "Визуальные материалы и документы доступны по запросу."}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-kv-navy/72 via-kv-navy/12 to-transparent" />
                <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                  {[item.country, item.city, language === "en" ? item.typeLabelEn ?? item.typeLabel : item.typeLabel].map((tag, index) => (
                    <span key={tag} className={`rounded-full px-2.5 py-1.5 text-[12px] font-extrabold backdrop-blur-md ${index === 0 ? "bg-kv-red" : "bg-white/20"}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-5.5">
                <h3 className="mb-3 text-xl font-bold leading-tight tracking-tight text-kv-navy">{language === "en" ? item.titleEn ?? item.title : item.title}</h3>
                <p className="mb-4 min-h-[66px] text-sm leading-relaxed text-kv-muted">{language === "en" ? item.descriptionEn ?? item.description : item.description}</p>
                <div className="mb-4 flex justify-between gap-3 border-b border-kv-line pb-4 text-[13px] text-kv-muted">
                  <span>{item.market}</span>
                  <strong className="text-base text-kv-red">{t.onRequest}</strong>
                </div>
                <ul className="mb-4.5 list-none space-y-2 p-0 text-sm text-kv-muted">
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    <span>{t.address}</span>
                    <strong className="text-kv-ink">{language === "en" ? item.addressEn ?? item.address : item.address}</strong>
                  </li>
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    <span>{t.area}</span>
                    <strong className="text-kv-ink">{item.areaDisplay}</strong>
                  </li>
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    <span>{t.seller}</span>
                    <strong className="text-kv-ink">{item.owner}</strong>
                  </li>
                </ul>
                <div className="grid grid-cols-2 gap-2.5">
                  <a href="#request" className="rounded-full bg-kv-navy py-3 text-center text-[13px] font-extrabold text-white transition-colors hover:bg-kv-navy-light">
                    {t.request}
                  </a>
                  <a href="#contacts" className="rounded-full border border-kv-line py-3 text-center text-[13px] font-extrabold text-kv-navy transition-colors hover:bg-kv-bg-warm">
                    {t.discuss}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {visibleObjects.length === 0 && (
          <div className="mt-5 rounded-kv-main border border-kv-line bg-kv-bg-warm p-5 font-bold text-kv-muted">
            {t.empty}
          </div>
        )}
      </div>
    </section>
  );
}
