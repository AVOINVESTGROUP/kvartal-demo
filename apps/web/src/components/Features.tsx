import type { SiteLanguage } from "./site-language";

const content = {
  ru: {
    kicker: "Подход",
    title: "KVARTAL работает с активами, где важны данные, доверие и переговорная позиция",
    text: "Начинаем с задачи клиента, проверяем объектную информацию и выстраиваем понятный маршрут сделки между собственником, покупателем и представителями сторон.",
    features: [
      ["01", "Представление стороны", "Ведем объект или покупателя как отдельную сторону сделки и защищаем коммерческие интересы клиента."],
      ["02", "Объекты от правообладателей", "Сохраняем контроль над информацией, условиями публикации и переговорным процессом по каждому объекту."],
      ["03", "Коммерческий и юридический контур", "Смотрим не только на площадь и цену, но и на документы, ограничения, назначение и сценарии использования."],
      ["04", "Сделка между партнерами", "Поддерживаем модель, где покупатель может прийти через одну организацию, а объект принадлежит другой стороне сети."],
    ],
  },
  en: {
    kicker: "Approach",
    title: "KVARTAL works with assets where data, trust and negotiation position matter",
    text: "We start from the client task, verify property information and build a clear deal route between owner, buyer and representatives.",
    features: [
      ["01", "Side representation", "We represent a property owner or a buyer as a separate deal side and protect the client's commercial interests."],
      ["02", "Rights-holder objects", "We preserve control over information, publication terms and negotiations for every object."],
      ["03", "Commercial and legal layer", "We look beyond area and price: documents, restrictions, permitted use and use scenarios matter."],
      ["04", "Partner-to-partner deals", "We support a model where a buyer comes through one organization and the object is represented by another network side."],
    ],
  },
};

export const Features = ({ language }: { language: SiteLanguage }) => {
  const t = content[language];

  return (
    <section id="about" className="bg-white py-14">
      <div className="mx-auto max-w-kv-container px-5">
        <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2.5 flex items-center gap-2.5 text-[13px] font-black uppercase tracking-widest text-kv-red before:h-[2px] before:w-[30px] before:bg-current before:content-['']">
              {t.kicker}
            </div>
            <h2 className="max-w-[760px] text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">{t.title}</h2>
          </div>
          <p className="max-w-[460px] leading-relaxed text-kv-muted">{t.text}</p>
        </div>

        <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
          {t.features.map(([num, title, text]) => (
            <div key={num} className="min-h-[200px] rounded-kv-main border border-kv-line bg-white p-5 shadow-sm transition-shadow hover:shadow-xl">
              <div className="mb-3.5 inline-grid h-10 w-10 place-items-center rounded-full bg-kv-navy text-sm font-black text-white">{num}</div>
              <h3 className="mb-2.5 text-xl font-bold leading-tight text-kv-navy">{title}</h3>
              <p className="text-[15px] leading-relaxed text-kv-muted">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
