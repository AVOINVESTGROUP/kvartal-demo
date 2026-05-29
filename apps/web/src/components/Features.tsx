const features = [
  {
    num: "01",
    title: "Представление стороны",
    text: "Ведем объект или покупателя как отдельную сторону сделки и защищаем коммерческие интересы клиента.",
  },
  {
    num: "02",
    title: "Объекты от правообладателей",
    text: "Сохраняем контроль над информацией, условиями публикации и переговорным процессом по каждому объекту.",
  },
  {
    num: "03",
    title: "Коммерческий и юридический контур",
    text: "Смотрим не только на площадь и цену, но и на документы, ограничения, назначение и сценарии использования.",
  },
  {
    num: "04",
    title: "Сделка между партнерами",
    text: "Поддерживаем модель, где покупатель может прийти через одну организацию, а объект принадлежит другой стороне сети.",
  },
];

export const Features = () => {
  return (
    <section id="about" className="bg-white py-20">
      <div className="mx-auto max-w-kv-container px-5">
        <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2.5 flex items-center gap-2.5 text-[13px] font-black uppercase tracking-widest text-kv-red before:h-[2px] before:w-[30px] before:bg-current before:content-['']">
              Подход
            </div>
            <h2 className="max-w-[760px] text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">
              KVARTAL работает с активами, где важны данные, доверие и переговорная позиция
            </h2>
          </div>
          <p className="max-w-[460px] leading-relaxed text-kv-muted">
            Начинаем с задачи клиента, проверяем объектную информацию и выстраиваем понятный маршрут сделки между собственником, покупателем и представителями сторон.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.num} className="min-h-[230px] rounded-kv-main border border-kv-line bg-white p-6.5 shadow-sm transition-shadow hover:shadow-xl">
              <div className="mb-4.5 inline-grid h-10.5 w-10.5 place-items-center rounded-full bg-kv-navy text-sm font-black text-white">{feature.num}</div>
              <h3 className="mb-2.5 text-xl font-bold leading-tight text-kv-navy">{feature.title}</h3>
              <p className="text-[15px] leading-relaxed text-kv-muted">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
