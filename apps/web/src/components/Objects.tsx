"use client";

import { FormEvent, useMemo, useState } from "react";

type ObjectItem = {
  title: string;
  type: string;
  district: string;
  area: number;
  areaDisplay: string;
  address: string;
  metaLabel: string;
  metaValue: string;
  tags: string[];
};

const objects: ObjectItem[] = [
  {
    title: "Особняк, 587,2 м²",
    type: "особняк нежилое здание",
    district: "Красносельский",
    area: 587.2,
    areaDisplay: "587,2 м²",
    address: "ул. 2-я Леснорядская, д. 4",
    metaLabel: "КН",
    metaValue: "77:01:003033:2729",
    tags: ["Особняк", "Нежилое здание"],
  },
  {
    title: "Особняк, 850,7 м²",
    type: "особняк нежилое здание",
    district: "Таганский",
    area: 850.7,
    areaDisplay: "850,7 м²",
    address: "2-й Гончарный пер., д. 6",
    metaLabel: "КН",
    metaValue: "77:01:0002023:1025",
    tags: ["TOP", "Таганский"],
  },
  {
    title: "Нежилое здание, 903,3 м²",
    type: "нежилое здание",
    district: "Мещанский",
    area: 903.3,
    areaDisplay: "903,3 м²",
    address: "Большой Кисельный пер., д. 5, стр. 1",
    metaLabel: "Статус",
    metaValue: "Нежилое здание",
    tags: ["Здание", "Мещанский"],
  },
  {
    title: "Особняк, 630,3 м²",
    type: "особняк нежилое здание",
    district: "Мещанский",
    area: 630.3,
    areaDisplay: "630,3 м²",
    address: "Цветной бульвар, д. 28, стр. 2",
    metaLabel: "КН",
    metaValue: "77:01:0001092:1016",
    tags: ["Особняк", "Цветной бульвар"],
  },
  {
    title: "Особняк, 774,4 м²",
    type: "особняк нежилое здание",
    district: "Таганский",
    area: 774.4,
    areaDisplay: "774,4 м²",
    address: "Большой Ватин пер., д. 8",
    metaLabel: "КН",
    metaValue: "77:01:0002024:1005",
    tags: ["Особняк", "Таганский"],
  },
];

export const Objects = () => {
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");
  const [areaFrom, setAreaFrom] = useState("");
  const [areaTo, setAreaTo] = useState("");

  const visibleObjects = useMemo(() => {
    const minArea = areaFrom === "" ? 0 : Number(areaFrom);
    const maxArea = areaTo === "" ? Number.POSITIVE_INFINITY : Number(areaTo);

    return objects.filter((item) => {
      const matchesType = type === "" || item.type.includes(type);
      const matchesDistrict = district === "" || item.district === district;
      const matchesArea = item.area >= minArea && item.area <= maxArea;

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
    <section id="objects" aria-labelledby="objects-title" className="py-20 bg-white">
      <div className="max-w-kv-container mx-auto px-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-10">
          <div>
            <span className="text-kv-red text-[13px] font-black uppercase tracking-widest mb-2.5 block">
              Витрина объектов
            </span>
            <h2 id="objects-title" className="text-kv-navy text-3xl md:text-5xl font-black leading-[1.08] tracking-tight max-w-3xl">
              Стартовая подборка особняков и нежилых зданий
            </h2>
          </div>
        </div>

        <form
          id="object-filter"
          aria-label="Фильтр объектов"
          className="p-6 border border-kv-line rounded-kv-main bg-white shadow-sm mb-7"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
            <div className="flex flex-col">
              <label htmlFor="filter-type" className="block mb-2 text-kv-muted text-[12px] font-extrabold uppercase tracking-widest">
                Тип объекта
              </label>
              <select
                id="filter-type"
                name="type"
                value={type}
                className="w-full min-h-[46px] p-3 border border-kv-line rounded-kv-form text-kv-ink bg-white outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setType(event.target.value)}
              >
                <option value="">Все типы</option>
                <option value="особняк">Особняк</option>
                <option value="нежилое здание">Нежилое здание</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="filter-district" className="block mb-2 text-kv-muted text-[12px] font-extrabold uppercase tracking-widest">
                Район
              </label>
              <select
                id="filter-district"
                name="district"
                value={district}
                className="w-full min-h-[46px] p-3 border border-kv-line rounded-kv-form text-kv-ink bg-white outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setDistrict(event.target.value)}
              >
                <option value="">Все районы</option>
                <option value="Красносельский">Красносельский</option>
                <option value="Таганский">Таганский</option>
                <option value="Мещанский">Мещанский</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="area-from" className="block mb-2 text-kv-muted text-[12px] font-extrabold uppercase tracking-widest">
                Площадь от
              </label>
              <input
                id="area-from"
                name="area_from"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="500"
                value={areaFrom}
                className="w-full min-h-[46px] p-3 border border-kv-line rounded-kv-form text-kv-ink bg-white outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setAreaFrom(event.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="area-to" className="block mb-2 text-kv-muted text-[12px] font-extrabold uppercase tracking-widest">
                Площадь до
              </label>
              <input
                id="area-to"
                name="area_to"
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="1000"
                value={areaTo}
                className="w-full min-h-[46px] p-3 border border-kv-line rounded-kv-form text-kv-ink bg-white outline-none focus:border-kv-navy-light focus:ring-4 focus:ring-kv-navy-light/10"
                onChange={(event) => setAreaTo(event.target.value)}
              />
            </div>

            <div className="flex gap-2.5">
              <button type="submit" className="bg-kv-navy text-white px-5 py-3 rounded-full font-extrabold hover:bg-kv-navy-light transition-all cursor-pointer">
                Найти
              </button>
              <button
                type="button"
                className="bg-white text-kv-navy px-5 py-3 rounded-full font-extrabold border border-kv-line hover:bg-kv-bg-warm transition-all cursor-pointer"
                onClick={resetFilters}
              >
                Сбросить
              </button>
            </div>
          </div>
        </form>

        <div className="flex justify-between gap-5 mb-5 text-kv-muted text-sm">
          <span id="objects-count">Показано объектов: {visibleObjects.length}</span>
          <span>Цена: по запросу</span>
        </div>

        <div id="objects-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleObjects.map((item) => (
            <article key={`${item.address}-${item.area}`} className="group overflow-hidden border border-kv-line rounded-kv-main bg-white shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all">
              <div className="relative h-52 p-4.5 flex flex-col justify-between text-white bg-[linear-gradient(135deg,rgba(7,29,58,0.86),rgba(13,46,88,0.62)),repeating-linear-gradient(45deg,#98a6b5,#98a6b5_1px,#b9c2cc_1px,#b9c2cc_16px)]">
                <div className="flex flex-wrap gap-2 z-10">
                  {item.tags.map((tag, index) => (
                    <span
                      key={tag}
                      className={`px-2.5 py-1.5 rounded-full text-[12px] font-extrabold backdrop-blur-md ${index === 0 ? "bg-kv-red" : "bg-white/16"}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-white/76 text-[13px] leading-snug z-10">
                  Место под фото объекта: фасад, входная группа, интерьеры, планировки.
                </span>
                <div className="absolute inset-4.5 border border-white/18 pointer-events-none" />
              </div>

              <div className="p-5.5">
                <h3 className="text-kv-navy text-xl font-bold mb-3 leading-tight tracking-tight">{item.title}</h3>
                <div className="flex justify-between gap-3 mb-4 pb-4 border-b border-kv-line text-kv-muted text-[13px]">
                  <span>Коммерческие условия</span>
                  <strong className="text-kv-red text-base">По запросу</strong>
                </div>
                <ul className="space-y-2 mb-4.5 text-kv-muted text-sm list-none p-0">
                  <li className="grid grid-cols-[80px,1fr] gap-2.5">
                    <span>Адрес</span>
                    <strong className="text-kv-ink">{item.address}</strong>
                  </li>
                  <li className="grid grid-cols-[80px,1fr] gap-2.5">
                    <span>Район</span>
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
                  <a href="#request" className="bg-kv-navy text-white py-3 rounded-full text-center text-[13px] font-extrabold hover:bg-kv-navy-light transition-colors">
                    Запросить
                  </a>
                  <a href="#contacts" className="border border-kv-line text-kv-navy py-3 rounded-full text-center text-[13px] font-extrabold hover:bg-kv-bg-warm transition-colors">
                    Обсудить
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {visibleObjects.length === 0 && (
          <div id="empty-state" className="mt-5 p-5 border border-kv-line rounded-kv-main bg-kv-bg-warm text-kv-muted font-bold">
            По выбранным параметрам объектов нет. Измените район, тип или диапазон площади.
          </div>
        )}
      </div>
    </section>
  );
};
