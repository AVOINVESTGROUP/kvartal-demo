"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

type ObjectItem = {
  title: string;
  type: string;
  district: string;
  area?: number;
  areaDisplay: string;
  address: string;
  metaLabel: string;
  metaValue: string;
  description: string;
  imageUrl?: string;
  tags: string[];
};

const objects: ObjectItem[] = [
  {
    title: "Складской комплекс в Батайске",
    type: "складской комплекс",
    district: "Батайск",
    address: "Ростовская область, г. Батайск, Совхозная ул., район 6Б",
    areaDisplay: "площадь уточняется",
    metaLabel: "Формат",
    metaValue: "склад / производство",
    description: "Складские помещения с высокими потолками, стеллажным хранением и подъездом к промышленной зоне.",
    imageUrl: "/images/objects/bataysk-warehouse.jpg",
    tags: ["Склад", "Батайск", "Производство"],
  },
  {
    title: "Гостиничный комплекс, Фигурная 45",
    type: "гостиничный комплекс",
    district: "Сириус",
    area: 57868,
    areaDisplay: "57 868 м² участок",
    address: "Краснодарский край, ф.т. Сириус, пгт. Сириус, ул. Фигурная, з/у 45",
    metaLabel: "КН",
    metaValue: "23:49:0402061:1072",
    description: "Земельный участок для размещения четырехзвездочных гостиничных комплексов на 700 и 420 номеров.",
    imageUrl: "/images/objects/figurnaya-45-map.jpg",
    tags: ["Гостиница", "Сириус", "57 868 м²"],
  },
  {
    title: "Земельный участок в Домодедово",
    type: "земельный участок",
    district: "Домодедово",
    area: 5615,
    areaDisplay: "5 615 м²",
    address: "Московская область, г.о. Домодедово, мкр. Южный",
    metaLabel: "КН",
    metaValue: "50:28:0060113:7403",
    description: "Участок рядом с трассой М-4 и сложившейся торговой инфраструктурой; разрешенное использование: магазины.",
    imageUrl: "/images/objects/domodedovo-land.jpg",
    tags: ["Земля", "Домодедово", "М-4"],
  },
  {
    title: "Земельный участок в Кубинке",
    type: "земельный участок",
    district: "Кубинка",
    area: 2353,
    areaDisplay: "2 353 м²",
    address: "Московская область, Кубинка, район строительного рынка",
    metaLabel: "КН",
    metaValue: "50:20:0090427:2085",
    description: "Участок у активного торгового потока; разрешенное использование: стоянка транспортных средств.",
    imageUrl: "/images/objects/kubinka-land.jpg",
    tags: ["Земля", "Кубинка", "Трафик"],
  },
  {
    title: "Участок, Истринский район, Холщевики",
    type: "земельный участок",
    district: "Истра",
    address: "Московская область, Истринский район, п. ст. Холщевики",
    areaDisplay: "площадь уточняется",
    metaLabel: "Источник",
    metaValue: "презентация KVARTAL",
    description: "Земельный актив из презентационных материалов KVARTAL; параметры будут уточнены после переноса данных в SSOT.",
    tags: ["Земля", "Истра", "Холщевики"],
  },
];

const objectTypes = Array.from(new Set(objects.map((item) => item.type)));
const districts = Array.from(new Set(objects.map((item) => item.district)));

export const Objects = () => {
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");
  const [areaFrom, setAreaFrom] = useState("");
  const [areaTo, setAreaTo] = useState("");

  const visibleObjects = useMemo(() => {
    const minArea = areaFrom === "" ? 0 : Number(areaFrom);
    const maxArea = areaTo === "" ? Number.POSITIVE_INFINITY : Number(areaTo);
    const hasAreaFilter = areaFrom !== "" || areaTo !== "";

    return objects.filter((item) => {
      const matchesType = type === "" || item.type === type;
      const matchesDistrict = district === "" || item.district === district;
      const matchesArea = !hasAreaFilter || (item.area !== undefined && item.area >= minArea && item.area <= maxArea);

      return matchesType && matchesDistrict && matchesArea;
    });
  }, [areaFrom, areaTo, district, type]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const resetFilters = () => {
    setType("");
    setDistrict("");
    setAreaFrom("");
    setAreaTo("");
  };

  return (
    <section id="objects" aria-labelledby="objects-title" className="bg-white py-20">
      <div className="mx-auto max-w-kv-container px-5">
        <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">
              Витрина объектов
            </span>
            <h2 id="objects-title" className="max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">
              Актуальные предложения для покупки и инвестиций
            </h2>
          </div>
        </div>

        <form
          id="object-filter"
          aria-label="Фильтр объектов"
          className="mb-7 rounded-kv-main border border-kv-line bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 items-end gap-3.5 md:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col">
              <label htmlFor="filter-type" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                Тип объекта
              </label>
              <select
                id="filter-type"
                name="type"
                value={type}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">Все типы</option>
                {objectTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="filter-district" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                Локация
              </label>
              <select
                id="filter-district"
                name="district"
                value={district}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setDistrict(event.target.value)}
              >
                <option value="">Все локации</option>
                {districts.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="area-from" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                Площадь от
              </label>
              <input
                id="area-from"
                name="area_from"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="2000"
                value={areaFrom}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setAreaFrom(event.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="area-to" className="mb-2 block text-[12px] font-extrabold uppercase tracking-widest text-kv-muted">
                Площадь до
              </label>
              <input
                id="area-to"
                name="area_to"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="60000"
                value={areaTo}
                className="min-h-[46px] w-full rounded-kv-form border border-kv-line bg-white p-3 text-kv-ink outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setAreaTo(event.target.value)}
              />
            </div>

            <div className="flex gap-2.5">
              <button type="submit" className="cursor-pointer rounded-full bg-kv-navy px-5 py-3 font-extrabold text-white transition-all hover:bg-kv-navy-light">
                Найти
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-full border border-kv-line bg-white px-5 py-3 font-extrabold text-kv-navy transition-all hover:bg-kv-bg-warm"
                onClick={resetFilters}
              >
                Сбросить
              </button>
            </div>
          </div>
        </form>

        <div className="mb-5 flex justify-between gap-5 text-sm text-kv-muted">
          <span id="objects-count">Показано объектов: {visibleObjects.length}</span>
          <span>Цена: по запросу</span>
        </div>

        <div id="objects-list" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleObjects.map((item) => (
            <article
              key={`${item.title}-${item.metaValue}`}
              className="group overflow-hidden rounded-kv-main border border-kv-line bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl"
            >
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
                  <div className="flex h-full items-end bg-[linear-gradient(135deg,rgba(7,29,58,0.86),rgba(13,46,88,0.62)),repeating-linear-gradient(45deg,#98a6b5,#98a6b5_1px,#b9c2cc_1px,#b9c2cc_16px)] p-4 text-[13px] leading-snug text-white/76">
                    Фото и план участка будут добавлены после оцифровки презентации.
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-kv-navy/72 via-kv-navy/12 to-transparent" />
                <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                  {item.tags.map((tag, index) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2.5 py-1.5 text-[12px] font-extrabold backdrop-blur-md ${index === 0 ? "bg-kv-red" : "bg-white/20"}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-5.5">
                <h3 className="mb-3 text-xl font-bold leading-tight tracking-tight text-kv-navy">{item.title}</h3>
                <p className="mb-4 min-h-[66px] text-sm leading-relaxed text-kv-muted">{item.description}</p>
                <div className="mb-4 flex justify-between gap-3 border-b border-kv-line pb-4 text-[13px] text-kv-muted">
                  <span>Коммерческие условия</span>
                  <strong className="text-base text-kv-red">По запросу</strong>
                </div>
                <ul className="mb-4.5 list-none space-y-2 p-0 text-sm text-kv-muted">
                  <li className="grid grid-cols-[80px,1fr] gap-2.5">
                    <span>Адрес</span>
                    <strong className="text-kv-ink">{item.address}</strong>
                  </li>
                  <li className="grid grid-cols-[80px,1fr] gap-2.5">
                    <span>Локация</span>
                    <strong className="text-kv-ink">{item.district}</strong>
                  </li>
                  <li className="grid grid-cols-[80px,1fr] gap-2.5">
                    <span>Площадь</span>
                    <strong className="text-kv-ink">{item.areaDisplay}</strong>
                  </li>
                  <li className="grid grid-cols-[80px,1fr] gap-2.5">
                    <span>{item.metaLabel}</span>
                    <strong className="text-kv-ink">{item.metaValue}</strong>
                  </li>
                </ul>
                <div className="grid grid-cols-2 gap-2.5">
                  <a href="#request" className="rounded-full bg-kv-navy py-3 text-center text-[13px] font-extrabold text-white transition-colors hover:bg-kv-navy-light">
                    Запросить
                  </a>
                  <a href="#contacts" className="rounded-full border border-kv-line py-3 text-center text-[13px] font-extrabold text-kv-navy transition-colors hover:bg-kv-bg-warm">
                    Обсудить
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {visibleObjects.length === 0 && (
          <div id="empty-state" className="mt-5 rounded-kv-main border border-kv-line bg-kv-bg-warm p-5 font-bold text-kv-muted">
            По выбранным параметрам объектов нет. Измените локацию, тип или диапазон площади.
          </div>
        )}
      </div>
    </section>
  );
};
