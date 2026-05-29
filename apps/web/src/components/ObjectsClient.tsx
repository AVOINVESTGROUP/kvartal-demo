"use client";

import { FormEvent, useMemo, useState } from "react";
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

type ObjectsClientProps = {
  objects: ObjectItem[];
  language: SiteLanguage;
};

export function ObjectsClient({ objects, language }: ObjectsClientProps) {
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
        <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">{t.kicker}</span>
            <h2 id="objects-title" className="max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">
              {t.title}
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-kv-muted">{t.subtitle}</p>
          </div>
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
