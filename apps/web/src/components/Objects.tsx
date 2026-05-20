export const Objects = () => {
  const objects = [
    {
      title: "Особняк на Большой Поляне",
      tags: ["ЦАО", "Продажа"],
      price: "1 250 000 000 ₽",
      area: "1 450 м²",
      parking: "12 м/м",
      type: "Особняк"
    },
    {
      title: "Офисное здание в Замоскворечье",
      tags: ["Аренда"],
      price: "2 800 000 ₽ / мес",
      area: "820 м²",
      parking: "6 м/м",
      type: "Офисное здание"
    },
    {
      title: "Представительский офис на Якиманке",
      tags: ["Продажа", "Топ"],
      price: "480 000 000 ₽",
      area: "540 м²",
      parking: "4 м/м",
      type: "Офис"
    }
  ];

  return (
    <section className="py-20 bg-kv-bg-warm">
      <div className="max-w-kv-container mx-auto px-5">
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-2.5 text-kv-red text-[13px] font-black uppercase tracking-widest before:content-[''] before:w-[30px] before:h-[2px] before:bg-current">
            Объекты
          </div>
          <h2 className="text-kv-navy text-3xl md:text-5xl font-black leading-[1.08] tracking-tight">
            Актуальные предложения в Москве
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {objects.map((obj, i) => (
            <div key={i} className="group overflow-hidden border border-kv-line rounded-kv-main bg-white shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all">
              <div className="relative h-52 p-4.5 flex flex-col justify-between text-white bg-[linear-gradient(135deg,rgba(7,29,58,0.86),rgba(13,46,88,0.62)),repeating-linear-gradient(45deg,#98a6b5,#98a6b5_1px,#b9c2cc_1px,#b9c2cc_16px)]">
                <div className="flex flex-wrap gap-2 z-10">
                  {obj.tags.map((tag, idx) => (
                    <span key={idx} className={`px-2.5 py-1.5 rounded-full text-[12px] font-extrabold backdrop-blur-md ${tag === 'Топ' ? 'bg-kv-red' : 'bg-white/16'}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-white/76 text-[13px] z-10">Фото объекта по запросу</div>
                <div className="absolute inset-4.5 border border-white/18 pointer-events-none"></div>
              </div>
              <div className="p-5.5">
                <h3 className="text-kv-navy text-xl font-bold mb-3 leading-tight tracking-tight">{obj.title}</h3>
                <div className="flex justify-between gap-3 mb-4 pb-4 border-b border-kv-line text-kv-muted text-[13px]">
                  <span>Стоимость:</span>
                  <strong className="text-kv-red text-base">{obj.price}</strong>
                </div>
                <ul className="space-y-2 mb-4.5 text-kv-muted text-sm list-none p-0">
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    Площадь: <span className="text-kv-ink font-bold">{obj.area}</span>
                  </li>
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    Парковка: <span className="text-kv-ink font-bold">{obj.parking}</span>
                  </li>
                  <li className="grid grid-cols-[90px,1fr] gap-2.5">
                    Тип: <span className="text-kv-ink font-bold">{obj.type}</span>
                  </li>
                </ul>
                <div className="grid grid-cols-2 gap-2.5">
                  <button className="bg-kv-navy text-white py-3 rounded-full text-[13px] font-extrabold hover:bg-kv-navy-light transition-colors cursor-pointer">
                    Подробнее
                  </button>
                  <button className="border border-kv-line text-kv-navy py-3 rounded-full text-[13px] font-extrabold hover:bg-kv-bg transition-colors cursor-pointer">
                    Презентация
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
