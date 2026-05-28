"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

export type ObjectItem = {
  id: string;
  title: string;
  type: string;
  country: string;
  city: string;
  market: string;
  area?: number;
  areaDisplay: string;
  address: string;
  owner: string;
  description: string;
  imageUrl?: string;
  tags: string[];
};

type ObjectsClientProps = {
  objects: ObjectItem[];
};

export function ObjectsClient({ objects }: ObjectsClientProps) {
  const [type, setType] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  const objectTypes = useMemo(() => Array.from(new Set(objects.map((item) => item.type))).sort(), [objects]);
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
    <section id="objects" aria-labelledby="objects-title" className="bg-white py-20">
      <div className="mx-auto max-w-kv-container px-5">
        <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">Vitrina obektov</span>
            <h2 id="objects-title" className="max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">
              Shared public inventory by country and city
            </h2>
          </div>
        </div>

        <form id="object-filter" aria-label="Object filter" className="mb-7 rounded-kv-main border border-kv-line bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 items-end gap-3.5 md:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col">
              <label htmlFor="filter-type" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                Object type
              </label>
              <select
                id="filter-type"
                name="type"
                value={type}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">All types</option>
                {objectTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="filter-country" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                Country
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
                <option value="">All countries</option>
                {countries.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="filter-city" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                City
              </label>
              <select
                id="filter-city"
                name="city"
                value={city}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setCity(event.target.value)}
              >
                <option value="">All cities</option>
                {cities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-kv-form border border-kv-line bg-kv-bg p-3">
              <div className="text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">Markets</div>
              <div className="mt-1 text-lg font-black text-kv-navy">{countries.length}</div>
            </div>

            <div className="flex gap-2.5">
              <button type="submit" className="cursor-pointer rounded-full bg-kv-navy px-5 py-3 font-extrabold text-white transition-all hover:bg-kv-navy-light">
                Find
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-full border border-kv-line bg-white px-5 py-3 font-extrabold text-kv-navy transition-all hover:bg-kv-bg-warm"
                onClick={resetFilters}
              >
                Reset
              </button>
            </div>
          </div>
        </form>

        <div className="mb-5 flex flex-wrap justify-between gap-5 text-sm text-kv-muted">
          <span>Shown objects: {visibleObjects.length}</span>
          <span>Source: PostgreSQL / Cloud Run API</span>
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
                    Visual materials and documents are available by request.
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-kv-navy/72 via-kv-navy/12 to-transparent" />
                <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                  {[item.country, item.city, item.type].map((tag, index) => (
                    <span key={tag} className={`rounded-full px-2.5 py-1.5 text-[12px] font-extrabold backdrop-blur-md ${index === 0 ? "bg-kv-red" : "bg-white/20"}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-5.5">
                <h3 className="mb-3 text-xl font-bold leading-tight tracking-tight text-kv-navy">{item.title}</h3>
                <p className="mb-4 min-h-[66px] text-sm leading-relaxed text-kv-muted">{item.description}</p>
                <div className="mb-4 flex justify-between gap-3 border-b border-kv-line pb-4 text-[13px] text-kv-muted">
                  <span>{item.market}</span>
                  <strong className="text-base text-kv-red">On request</strong>
                </div>
                <ul className="mb-4.5 list-none space-y-2 p-0 text-sm text-kv-muted">
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    <span>Address</span>
                    <strong className="text-kv-ink">{item.address}</strong>
                  </li>
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    <span>Area</span>
                    <strong className="text-kv-ink">{item.areaDisplay}</strong>
                  </li>
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    <span>Seller</span>
                    <strong className="text-kv-ink">{item.owner}</strong>
                  </li>
                </ul>
                <div className="grid grid-cols-2 gap-2.5">
                  <a href="#request" className="rounded-full bg-kv-navy py-3 text-center text-[13px] font-extrabold text-white transition-colors hover:bg-kv-navy-light">
                    Request
                  </a>
                  <a href="#contacts" className="rounded-full border border-kv-line py-3 text-center text-[13px] font-extrabold text-kv-navy transition-colors hover:bg-kv-bg-warm">
                    Discuss
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {visibleObjects.length === 0 && (
          <div className="mt-5 rounded-kv-main border border-kv-line bg-kv-bg-warm p-5 font-bold text-kv-muted">
            No objects match the selected country, city, and type.
          </div>
        )}
      </div>
    </section>
  );
}
