import type { SiteLanguage } from "./site-language";

export const Hero = ({ language }: { language: SiteLanguage }) => {
  const t = {
    ru: {
      kicker: "Коммерческая недвижимость и инвестиционные объекты",
      title: "KVARTAL: подбор и сопровождение сделок с недвижимостью",
      lead: "Работаем с коммерческими объектами, земельными участками, складскими и гостиничными активами. Представляем интересы собственников и покупателей в сложных сделках.",
      objects: "Смотреть объекты",
      consult: "Запросить консультацию",
      stat1: "объектов в общей витрине",
      stat2: "объектов KVARTAL Moscow",
      formTitle: "Подобрать объект",
      formText: "Оставьте задачу, и мы свяжемся с вами по телефону +7 (977) 291-95-73.",
      name: "Ваше имя",
      task: "Задача и бюджет",
      send: "Отправить",
      consent: "Согласие с политикой обработки персональных данных",
    },
    en: {
      kicker: "Commercial real estate and investment assets",
      title: "KVARTAL: real estate selection and deal support",
      lead: "We work with commercial properties, land plots, warehouse and hospitality assets. We represent owners and buyers in complex transactions.",
      objects: "View objects",
      consult: "Request consultation",
      stat1: "objects in public inventory",
      stat2: "KVARTAL Moscow objects",
      formTitle: "Select a property",
      formText: "Leave your task and we will contact you by phone: +7 (977) 291-95-73.",
      name: "Your name",
      task: "Task and budget",
      send: "Send",
      consent: "Consent to personal data processing",
    },
  }[language];

  return (
    <section className="kv-hero relative isolate overflow-hidden text-white">
      <div className="kv-hero-grid pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto w-full max-w-kv-container px-5 py-9 sm:py-11 lg:py-12 xl:py-14">
        <div className="min-w-0 max-w-[720px]">
          <div className="mb-4 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-widest text-white/80 before:h-[2px] before:w-[34px] before:bg-kv-gold before:content-[''] sm:text-[13px]">
            {t.kicker}
          </div>

          <h1 className="max-w-[700px] text-[28px] font-black leading-[1.06] tracking-0 min-[420px]:text-[34px] sm:text-[54px] sm:leading-[0.98] lg:text-[64px] xl:text-[72px]">
            {t.title}
          </h1>

          <p className="mt-4 max-w-[620px] text-base leading-relaxed text-white/78 sm:text-xl">
            {t.lead}
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="#objects" className="min-h-[52px] rounded-full bg-kv-red px-6 py-3.5 text-center font-extrabold text-white shadow-xl transition-all hover:-translate-y-px hover:bg-kv-red-dark sm:px-8">
              {t.objects}
            </a>
            <a href="#request" className="min-h-[52px] rounded-full border border-white/28 bg-white/10 px-6 py-3.5 text-center font-extrabold text-white transition-all hover:bg-white/20 sm:px-8">
              {t.consult}
            </a>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-kv-form border border-white/12 bg-white/6 p-3.5">
              <span className="block text-2xl font-black text-white">9</span>
              <span className="mt-1 block text-[13px] text-white/68">{t.stat1}</span>
            </div>
            <div className="rounded-kv-form border border-white/12 bg-white/6 p-3.5">
              <span className="block text-2xl font-black text-white">5</span>
              <span className="mt-1 block text-[13px] text-white/68">{t.stat2}</span>
            </div>
          </div>

          <div id="request" className="mt-4 rounded-kv-main border border-white/16 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:p-4">
            <div className="mb-2.5">
              <h2 className="text-xl font-bold leading-tight">{t.formTitle}</h2>
              <p className="mt-1 text-[13px] leading-snug text-white/68">{t.formText}</p>
            </div>
            <form className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1fr,1fr] xl:grid-cols-[1fr,1fr,1.1fr,auto]">
              <input type="text" placeholder={t.name} className="h-11 w-full rounded-kv-form bg-white px-3.5 text-sm text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18" />
              <input type="tel" placeholder="+7 (___) ___-__-__" className="h-11 w-full rounded-kv-form bg-white px-3.5 text-sm text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18" />
              <input type="text" placeholder={t.task} className="h-11 w-full rounded-kv-form bg-white px-3.5 text-sm text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18 sm:col-span-2 xl:col-span-1" />
              <button type="submit" className="h-11 cursor-pointer rounded-full bg-kv-red px-5 text-sm font-extrabold text-white shadow-lg transition-all hover:bg-kv-red-dark sm:col-span-2 xl:col-span-1">
                {t.send}
              </button>
              <label className="flex gap-2 text-[11px] leading-snug text-white/62 sm:col-span-2 xl:col-span-4">
                <input type="checkbox" className="mt-0.5" defaultChecked />
                <span>{t.consent}</span>
              </label>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
