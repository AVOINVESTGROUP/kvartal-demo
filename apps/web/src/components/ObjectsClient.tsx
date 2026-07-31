"use client";

import { useState, useEffect, useRef } from "react";
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
  isNew?: boolean;
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

export type SessionContext = {
  detectedCountry?: string;
  detectedCity?: string | null;
  language?: string;
  device?: string;
  purchasingPower?: string;
  refererHint?: string;
  segment?: string;
  intent?: string;
  preferredCurrency?: string;
  usdToPreferred?: number;
  homeMarket?: {
    slug: string;
    city: string;
    country: string;
    residentialPriceUsd: number | null;
  } | null;
  crossMarketComparisons?: Array<{
    market: { slug: string; city: string; country: string };
    sqmRatio: number;
    pctMoreSqm: number;
  }>;
};

type AiSearchResult = {
  ok: boolean;
  query: string;
  filters: Record<string, unknown>;
  insight: string;
  objects: ObjectItem[];
  crossMarketAlternatives: ObjectItem[];
};

type ObjectsClientProps = {
  objects: ObjectItem[];
  language: SiteLanguage;
  marketSnapshot: MarketSnapshot | null;
  apiBaseUrl: string;
};

const COUNTRY_FLAGS: Record<string, string> = {
  RU: "🇷🇺", AE: "🇦🇪", GE: "🇬🇪", AM: "🇦🇲", US: "🇺🇸",
  DE: "🇩🇪", FR: "🇫🇷", ES: "🇪🇸", IT: "🇮🇹", TR: "🇹🇷",
};

const COUNTRY_NAMES: Record<string, { ru: string; en: string }> = {
  RU: { ru: "Россия", en: "Russia" },
  AE: { ru: "ОАЭ", en: "UAE" },
  GE: { ru: "Грузия", en: "Georgia" },
  AM: { ru: "Армения", en: "Armenia" },
  US: { ru: "США", en: "USA" },
  DE: { ru: "Германия", en: "Germany" },
  FR: { ru: "Франция", en: "France" },
  ES: { ru: "Испания", en: "Spain" },
  IT: { ru: "Италия", en: "Italy" },
  TR: { ru: "Турция", en: "Turkey" },
};

function flag(country: string) {
  return COUNTRY_FLAGS[country] ?? "🌐";
}

function formatPrice(usd: number | null | undefined, usdToPreferred: number, currency: string) {
  if (!usd) return null;
  const value = Math.round(usd * usdToPreferred);
  const formatted = value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)} млн`
    : value >= 1_000
    ? `${Math.round(value / 1_000)} тыс.`
    : String(value);
  const symbol = currency === "RUB" ? "₽" : currency === "AED" ? "AED" : currency === "GEL" ? "₾" : "$";
  return `≈ ${formatted} ${symbol}`;
}

function PropertyCard({
  item,
  language,
  homeMarketPriceUsd,
  usdToPreferred,
  preferredCurrency,
}: {
  item: ObjectItem;
  language: SiteLanguage;
  homeMarketPriceUsd?: number | null;
  usdToPreferred: number;
  preferredCurrency: string;
}) {
  const title = language === "en" ? item.titleEn ?? item.title : item.title;
  const typeLabel = language === "en" ? item.typeLabelEn ?? item.typeLabel : item.typeLabel;

  return (
    <article className="group overflow-hidden rounded-kv-main border border-kv-line bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl">
      <div className="relative h-48 overflow-hidden bg-kv-navy text-white">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-end bg-[linear-gradient(135deg,rgba(7,29,58,0.86),rgba(13,46,88,0.62)),repeating-linear-gradient(45deg,#98a6b5,#98a6b5_1px,#b9c2cc_1px,#b9c2cc_16px)] p-4 text-[13px] leading-snug text-white/80">
            {language === "en" ? "Visual materials available on request." : "Материалы по запросу."}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-kv-navy/72 via-kv-navy/12 to-transparent" />
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-kv-red px-2.5 py-1 text-[11px] font-extrabold text-white backdrop-blur-md">
            {flag(item.country)} {item.city}
          </span>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold text-white backdrop-blur-md">
            {typeLabel}
          </span>
        </div>
        {item.isNew && (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-white">
            НОВЫЙ
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="mb-2 text-base font-bold leading-tight tracking-tight text-kv-navy">{title}</h3>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <span className="text-sm text-kv-muted">{item.areaDisplay}</span>
          <strong className="text-base text-kv-red">{language === "en" ? "On request" : "По запросу"}</strong>
        </div>
        {homeMarketPriceUsd && item.area && (
          <div className="mb-3 rounded-md bg-kv-bg px-3 py-2 text-[12px] font-bold text-kv-navy">
            {formatPrice(item.area * homeMarketPriceUsd, usdToPreferred, preferredCurrency) && (
              <span>💡 {language === "en" ? "Home market equiv." : "Эквивалент вашего рынка"}: {formatPrice(item.area * homeMarketPriceUsd, usdToPreferred, preferredCurrency)}</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a href="#request" className="rounded-full bg-kv-navy py-2.5 text-center text-[12px] font-extrabold text-white transition-colors hover:bg-kv-navy-light">
            {language === "en" ? "Request" : "Запросить"}
          </a>
          <a href="#contacts" className="rounded-full border border-kv-line py-2.5 text-center text-[12px] font-extrabold text-kv-navy transition-colors hover:bg-kv-bg-warm">
            {language === "en" ? "Discuss" : "Обсудить"}
          </a>
        </div>
      </div>
    </article>
  );
}

function MarketSnapshotTicker({ snapshot, language }: { snapshot: MarketSnapshot | null; language: SiteLanguage }) {
  const labels = language === "en"
    ? { title: "AI market estimate", updated: "updated monthly" }
    : { title: "AI оценка рынка", updated: "обновляется ежемесячно" };
  const homeMarket = snapshot?.homeMarket ?? null;
  const rotatingMarkets = snapshot?.otherMarkets ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (rotatingMarkets.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex((i) => (i + 1) % rotatingMarkets.length), 3600);
    return () => window.clearInterval(timer);
  }, [rotatingMarkets.length]);

  const activeMarket = rotatingMarkets[activeIndex % Math.max(rotatingMarkets.length, 1)] ?? null;

  function tickerVal(market: MarketSnapshotMarket | null) {
    const ind = market?.indicators.residential ?? market?.indicators.commercial;
    if (!ind || ind.value === null) return "—";
    return `$${Math.round(ind.value).toLocaleString("en-US")} / m²`;
  }

  return (
    <aside className="w-full lg:max-w-[360px]" aria-label={labels.title}>
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-widest text-kv-red">
        <span>{labels.title}</span>
      </div>
      <div className="inline-grid w-full grid-cols-[minmax(92px,0.55fr),1fr] overflow-hidden rounded-kv-form border border-kv-navy/24 bg-white text-sm shadow-sm">
        <div className="border-b border-r border-kv-navy/24 px-3 py-2 font-bold text-kv-navy">{homeMarket?.city ?? "Moscow"}</div>
        <div className="border-b border-kv-navy/24 px-3 py-2 font-semibold text-kv-ink">{tickerVal(homeMarket)}</div>
        <div className="border-r border-kv-navy/24 px-3 py-2 font-bold text-kv-navy">{activeMarket?.city ?? "—"}</div>
        <div className="px-3 py-2 font-semibold text-kv-ink">{tickerVal(activeMarket)}</div>
      </div>
      <div className="mt-1.5 text-[11px] leading-snug text-kv-muted">{labels.updated}.</div>
    </aside>
  );
}

export function ObjectsClient({ objects, language, marketSnapshot }: ObjectsClientProps) {
  const [query, setQuery] = useState("");
  const [sessionCtx, setSessionCtx] = useState<SessionContext | null>(null);
  const [searchResult, setSearchResult] = useState<AiSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleCountry(country: string) {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  }

  const usdToPreferred = sessionCtx?.usdToPreferred ?? 1;
  const preferredCurrency = sessionCtx?.preferredCurrency ?? "USD";
  const homeMarketPriceUsd = sessionCtx?.homeMarket?.residentialPriceUsd ?? null;
  const crossComps = sessionCtx?.crossMarketComparisons ?? [];
  const bestCrossComp = crossComps[0] ?? null;

  // Fetch session context on mount via Next.js proxy (avoids Cloud Run auth)
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch("/api/v1/public/session-context", {
      headers: {
        "x-client-timezone": tz,
        "x-client-language": navigator.language,
      },
    })
      .then((r) => r.json())
      .then((data: SessionContext) => setSessionCtx(data))
      .catch(() => null);
  }, []);

  // Suggested queries based on session profile
  const suggestedQueries = (() => {
    const seg = sessionCtx?.segment;
    const intent = sessionCtx?.intent;
    if (seg === "russian_investor" && intent === "active_search") {
      return ["ВНЖ в Грузии", "Инвестиция в ОАЭ", "Квартира у моря"];
    }
    if (seg === "us_investor") {
      return ["Premium apartment Dubai", "Development project Georgia", "Investment property"];
    }
    return language === "en"
      ? ["Apartment near sea", "Investment project Dubai", "Warehouse Moscow"]
      : ["Квартира у моря", "Склад в Подмосковье", "Девелоперский проект"];
  })();

  // Personalized first-screen headline
  const headline = (() => {
    if (!sessionCtx) return null;
    const { detectedCity, homeMarket } = sessionCtx;
    if (bestCrossComp && homeMarket) {
      const pct = bestCrossComp.pctMoreSqm;
      const city = bestCrossComp.market.city;
      return language === "en"
        ? `You're from ${homeMarket.city}. In ${city} — ${pct}% more space for the same price.`
        : `Вы из ${detectedCity ?? homeMarket.city}. В ${city} за те же деньги — на ${pct}% больше площади.`;
    }
    return null;
  })();

  // Group objects by country for default display
  const countryGroups = (() => {
    const groups = new Map<string, ObjectItem[]>();
    for (const obj of objects) {
      const list = groups.get(obj.country) ?? [];
      list.push(obj);
      groups.set(obj.country, list);
    }
    // Put user's country first
    const userCountry = sessionCtx?.detectedCountry;
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === userCountry) return -1;
      if (b === userCountry) return 1;
      return (groups.get(b)?.length ?? 0) - (groups.get(a)?.length ?? 0);
    });
    return sorted;
  })();

  // Featured: one stable object per country. Render output must stay deterministic.
  const featuredObjects = (() => {
    const byCountry = new Map<string, ObjectItem[]>();
    for (const obj of objects) {
      const list = byCountry.get(obj.country) ?? [];
      list.push(obj);
      byCountry.set(obj.country, list);
    }
    return Array.from(byCountry.values())
      .map((list) => list[0])
      .filter((o): o is ObjectItem => o !== undefined)
      .slice(0, 3);
  })();

  async function handleSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setSearchResult(null);
    try {
      const res = await fetch("/api/v1/public/ai-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, tenant: "kvartal", language, sessionContext: sessionCtx }),
      });
      const data = await res.json() as AiSearchResult;
      setSearchResult(data);
    } catch {
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setQuery("");
    setSearchResult(null);
  }

  const t = {
    ru: {
      kicker: "Витрина объектов",
      title: "Общий опубликованный пул объектов по странам и городам",
      subtitle: "Это объекты, разрешённые к показу на сайтах партнёров в их собственном дизайне.",
      placeholder: "Опишите что ищете — квартира, склад, проект, страна...",
      find: "Найти",
      reset: "Сбросить",
      newObjects: "Новые поступления",
      foundBy: "Gemini нашёл",
      noResults: "По вашему запросу объектов не найдено.",
      crossMarket: "Альтернативы в других рынках",
      yourMarketVsWorld: "Ваш рынок против мира",
      forBudget: "За",
      youGet: "вы получаете",
      showAll: "Смотреть все в",
    },
    en: {
      kicker: "Public inventory",
      title: "Shared published inventory by country and city",
      subtitle: "These are objects approved for display on partner websites in their own design.",
      placeholder: "Describe what you're looking for — apartment, warehouse, project, country...",
      find: "Search",
      reset: "Reset",
      newObjects: "New listings",
      foundBy: "Gemini found",
      noResults: "No objects found for your query.",
      crossMarket: "Alternatives in other markets",
      yourMarketVsWorld: "Your market vs the world",
      forBudget: "For",
      youGet: "you get",
      showAll: "See all in",
    },
  }[language];

  const displayObjects = searchResult ? searchResult.objects : null;
  const crossAlts = searchResult?.crossMarketAlternatives ?? [];

  return (
    <section id="objects" aria-labelledby="objects-title" className="bg-white py-14">
      <div className="mx-auto max-w-kv-container px-5">
        {/* Header */}
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

        {/* БЛОК 1: AI Search */}
        <div className="mb-5 rounded-kv-main border border-kv-line bg-white p-5 shadow-sm">
          {headline && !searchResult && (
            <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-kv-navy">
              <span className="text-kv-red">💡</span>
              <span>{headline}</span>
            </div>
          )}
          {searchResult && (
            <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-kv-navy">
              <span className="text-kv-red">✦</span>
              <span>{searchResult.insight || `${t.foundBy}: ${searchResult.objects.length}`}</span>
            </div>
          )}
          <div className="flex gap-2.5">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder={t.placeholder}
              className="min-h-[48px] flex-1 rounded-kv-form border border-kv-line bg-white px-4 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={loading}
              className="rounded-full bg-kv-navy px-6 py-3 font-extrabold text-white transition-all hover:bg-kv-navy-light disabled:opacity-60"
            >
              {loading ? "..." : t.find}
            </button>
            {searchResult && (
              <button
                onClick={handleReset}
                className="rounded-full border border-kv-line bg-white px-5 py-3 font-extrabold text-kv-navy transition-all hover:bg-kv-bg-warm"
              >
                {t.reset}
              </button>
            )}
          </div>
          {!searchResult && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedQueries.map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); handleSearch(q); }}
                  className="rounded-full border border-kv-line bg-kv-bg px-3 py-1.5 text-[12px] font-bold text-kv-navy transition-colors hover:border-kv-navy hover:bg-white"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* БЛОК 2: Подборка объектов */}
        {!searchResult && (
          <>
            {featuredObjects.length > 0 && (
              <div className="mb-8">
                <div className="mb-4 text-[12px] font-black uppercase tracking-widest text-kv-muted">{t.newObjects}</div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {featuredObjects.map((item) => (
                    <PropertyCard
                      key={item.id}
                      item={item}
                      language={language}
                      homeMarketPriceUsd={homeMarketPriceUsd}
                      usdToPreferred={usdToPreferred}
                      preferredCurrency={preferredCurrency}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* БЛОК 3: Ваш рынок против мира */}
            {crossComps.length > 0 && homeMarketPriceUsd && (
              <div className="mb-8 rounded-kv-main border border-kv-line bg-kv-bg p-5">
                <div className="mb-4 text-[12px] font-black uppercase tracking-widest text-kv-muted">{t.yourMarketVsWorld}</div>
                <div className="space-y-3">
                  {/* Home market bar */}
                  <div className="flex items-center gap-3">
                    <div className="w-28 text-[13px] font-bold text-kv-navy">
                      {flag(sessionCtx?.detectedCountry ?? "")} {sessionCtx?.homeMarket?.city ?? "—"}
                    </div>
                    <div className="h-6 flex-1 overflow-hidden rounded-full bg-kv-line">
                      <div className="h-full w-[40%] rounded-full bg-kv-navy" />
                    </div>
                    <div className="w-16 text-right text-[13px] font-bold text-kv-navy">базовый</div>
                  </div>
                  {crossComps.map((comp) => {
                    const barWidth = Math.min(Math.round(comp.sqmRatio * 40), 95);
                    return (
                      <div key={comp.market.slug} className="flex items-center gap-3">
                        <div className="w-28 text-[13px] font-bold text-kv-navy">
                          {flag(comp.market.country)} {comp.market.city}
                        </div>
                        <div className="h-6 flex-1 overflow-hidden rounded-full bg-kv-line">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="w-16 text-right text-[13px] font-bold text-emerald-600">+{comp.pctMoreSqm}%</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {crossComps.slice(0, 2).map((comp) => (
                    <button
                      key={comp.market.slug}
                      onClick={() => { const q = `${comp.market.city}`; setQuery(q); handleSearch(q); }}
                      className="rounded-full bg-kv-navy px-4 py-2 text-[12px] font-extrabold text-white transition-colors hover:bg-kv-navy-light"
                    >
                      {t.showAll} {comp.market.city} →
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Objects by country — first row visible, rest collapsed */}
            {countryGroups.map(([country, countryObjects]) => {
              const isExpanded = expandedCountries.has(country);
              const visible = isExpanded ? countryObjects : countryObjects.slice(0, 3);
              const hidden = countryObjects.length - 3;
              return (
                <div key={country} className="mb-8">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{flag(country)}</span>
                      <div>
                        <div className="text-xl font-black tracking-tight text-kv-navy">
                          {COUNTRY_NAMES[country]?.[language === "en" ? "en" : "ru"] ?? country}
                        </div>
                        <div className="text-[12px] text-kv-muted">
                          {countryObjects.length} {language === "en" ? "objects" : "объектов"}
                        </div>
                      </div>
                    </div>
                    {hidden > 0 && (
                      <button
                        onClick={() => toggleCountry(country)}
                        className="text-[12px] font-extrabold text-kv-navy underline-offset-2 hover:underline"
                      >
                        {isExpanded
                          ? (language === "en" ? "Collapse" : "Свернуть")
                          : (language === "en" ? `+${hidden} more` : `Ещё ${hidden}`)}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {visible.map((item) => (
                      <PropertyCard
                        key={item.id}
                        item={item}
                        language={language}
                        homeMarketPriceUsd={homeMarketPriceUsd}
                        usdToPreferred={usdToPreferred}
                        preferredCurrency={preferredCurrency}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Search results */}
        {searchResult && (
          <>
            {displayObjects && displayObjects.length > 0 ? (
              <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {displayObjects.map((item) => (
                  <PropertyCard
                    key={item.id}
                    item={item}
                    language={language}
                    homeMarketPriceUsd={homeMarketPriceUsd}
                    usdToPreferred={usdToPreferred}
                    preferredCurrency={preferredCurrency}
                  />
                ))}
              </div>
            ) : (
              <div className="mb-8 rounded-kv-main border border-kv-line bg-kv-bg-warm p-5 font-bold text-kv-muted">
                {t.noResults}
              </div>
            )}

            {crossAlts.length > 0 && (
              <div className="mb-8">
                <div className="mb-4 text-[12px] font-black uppercase tracking-widest text-kv-muted">{t.crossMarket}</div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {crossAlts.map((item) => (
                    <PropertyCard
                      key={item.id}
                      item={item}
                      language={language}
                      homeMarketPriceUsd={homeMarketPriceUsd}
                      usdToPreferred={usdToPreferred}
                      preferredCurrency={preferredCurrency}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
