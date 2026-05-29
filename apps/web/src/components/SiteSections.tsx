import type { SiteLanguage } from "./site-language";

const content = {
  ru: {
    servicesKicker: "Услуги",
    servicesTitle: "Закрываем ключевые задачи по коммерческой недвижимости и инвестиционным объектам",
    servicesText: "Сайт рассчитан на заявки от покупателей, инвесторов, арендаторов, собственников и партнерских офисов.",
    services: [
      ["Подбор объекта", "Формируем короткий список объектов под назначение, бюджет, город, площадь, документы и требования к сделке."],
      ["Продажа и экспозиция", "Готовим объект к публикации, собираем обращения, квалифицируем спрос и ведем переговоры до сделки."],
      ["Инвестиционная оценка", "Сравниваем локацию, ликвидность, назначение, потенциал развития и сценарии доходности."],
      ["Сопровождение сделки", "Координируем переговоры, документы, проверку объекта, график платежей и выход на подписание."],
    ],
    buyerTitle: "Подбор без лишних просмотров",
    buyerKicker: "Покупателям и инвесторам",
    buyerText: "Перед показами фиксируем требования и отсеиваем объекты, которые не подходят по назначению, площади, локации или юридическим ограничениям.",
    buyerItems: ["Объекты под офис, склад, гостиницу, участок, mixed-use или инвестиционный проект.", "Сравнение вариантов по локации, площади, ликвидности и правовому контуру.", "Подготовка вопросов для правообладателя информации и стороны продавца."],
    ownerTitle: "Экспозиция объекта и квалификация спроса",
    ownerKicker: "Собственникам",
    ownerText: "Готовим карточку объекта, управляем уровнем публичности, собираем обращения и ведем коммуникацию до сделки.",
    ownerItems: ["Упаковка: фото, описание, характеристики, презентация, документы и условия.", "Публикация в общей витрине с учетом разрешений правообладателя информации.", "Организация показов, переговоров и безопасного обмена документами."],
    processKicker: "Процесс",
    processTitle: "Как проходит работа",
    processText: "Структура помогает клиенту понять порядок действий до заявки, проверки объекта и сделки.",
    process: [
      ["Шаг 1", "Бриф", "Фиксируем цель: покупка, аренда, продажа, инвестиции, требования к объекту и сроки."],
      ["Шаг 2", "Подбор", "Отбираем объекты по стране, городу, площади, назначению, документам и коммерческим условиям."],
      ["Шаг 3", "Проверка", "Уточняем актуальность данных, правовой контур, ограничения и готовим вопросы к стороне объекта."],
      ["Шаг 4", "Сделка", "Сопровождаем переговоры, согласование условий, документы и взаимодействие партнерских организаций."],
    ],
    ctaTitle: "Нужен объект под конкретную задачу?",
    ctaText: "Опишите формат бизнеса, бюджет, страну, город и площадь. Мы подготовим подборку по открытым и закрытым предложениям.",
    phone: "Телефон",
    task: "Что ищете: тип объекта, город, площадь, бюджет",
    submit: "Получить подборку",
    contactsKicker: "Контакты",
    contactsTitle: "Связаться с KVARTAL",
    contactsText: "Для заявок по объектам, подбору, партнерским показам и сопровождению сделки.",
    office: "Офис",
    messengers: "Мессенджеры",
    mapTitle: "Карта объектов и партнерских рынков",
    mapText: "На рабочей версии здесь будет карта с объектами общей витрины: Москва, Московская область, Ростовская область, Сириус, Тбилиси, Дубай и Ереван.",
  },
  en: {
    servicesKicker: "Services",
    servicesTitle: "We cover key commercial real estate and investment property tasks",
    servicesText: "The site is built for requests from buyers, investors, tenants, owners and partner offices.",
    services: [
      ["Property selection", "We prepare a shortlist by use, budget, city, area, documents and deal requirements."],
      ["Sale and exposure", "We prepare the object for publication, collect requests, qualify demand and negotiate through closing."],
      ["Investment review", "We compare location, liquidity, use, development potential and income scenarios."],
      ["Deal support", "We coordinate negotiations, documents, object checks, payment schedule and signing."],
    ],
    buyerTitle: "Selection without unnecessary viewings",
    buyerKicker: "For buyers and investors",
    buyerText: "Before viewings we fix requirements and filter out objects that do not fit use, area, location or legal restrictions.",
    buyerItems: ["Offices, warehouses, hotels, land, mixed-use and investment projects.", "Comparison by location, area, liquidity and legal context.", "Questions prepared for the information rights-holder and seller side."],
    ownerTitle: "Object exposure and demand qualification",
    ownerKicker: "For owners",
    ownerText: "We prepare the object card, manage publicity level, collect requests and keep communication moving toward the deal.",
    ownerItems: ["Packaging: photos, description, characteristics, presentation, documents and terms.", "Publication in the shared inventory according to the information rights-holder permissions.", "Viewings, negotiations and secure document exchange."],
    processKicker: "Process",
    processTitle: "How the work goes",
    processText: "The structure helps the client understand the path from request to object check and deal.",
    process: [
      ["Step 1", "Brief", "We define the goal: purchase, lease, sale, investment, object requirements and timing."],
      ["Step 2", "Selection", "We select objects by country, city, area, use, documents and commercial terms."],
      ["Step 3", "Check", "We verify data, legal context, restrictions and questions for the object side."],
      ["Step 4", "Deal", "We support negotiations, terms, documents and partner organization interaction."],
    ],
    ctaTitle: "Need a property for a specific task?",
    ctaText: "Describe the business format, budget, country, city and area. We will prepare a selection from open and closed offers.",
    phone: "Phone",
    task: "What are you looking for: object type, city, area, budget",
    submit: "Get selection",
    contactsKicker: "Contacts",
    contactsTitle: "Contact KVARTAL",
    contactsText: "For property requests, selection, partner viewings and deal support.",
    office: "Office",
    messengers: "Messengers",
    mapTitle: "Objects and partner markets map",
    mapText: "The working version will include a map of the shared inventory: Moscow, Moscow region, Rostov region, Sirius, Tbilisi, Dubai and Yerevan.",
  },
};

export const SiteSections = ({ language }: { language: SiteLanguage }) => {
  const t = content[language];

  return (
    <>
      <section className="bg-kv-bg py-14" id="services" aria-labelledby="services-title">
        <div className="mx-auto max-w-kv-container px-5">
          <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">{t.servicesKicker}</span>
              <h2 id="services-title" className="max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">{t.servicesTitle}</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-kv-muted">{t.servicesText}</p>
          </div>
          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
            {t.services.map(([title, text], index) => (
              <article key={title} className="min-h-[200px] rounded-kv-main border border-kv-line bg-white p-5 shadow-sm">
                <span className="mb-4 block text-sm font-black text-kv-red">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mb-3 text-xl font-bold leading-tight text-kv-navy">{title}</h3>
                <p className="text-[15px] leading-relaxed text-kv-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-kv-bg-warm py-14" id="owners" aria-labelledby="owners-title">
        <div className="mx-auto grid max-w-kv-container gap-5 px-5 lg:grid-cols-2">
          {[
            [t.buyerKicker, t.buyerTitle, t.buyerText, t.buyerItems],
            [t.ownerKicker, t.ownerTitle, t.ownerText, t.ownerItems],
          ].map(([kicker, title, text, items]) => (
            <div key={String(title)} className="rounded-kv-main border border-kv-line bg-white p-5 shadow-sm">
              <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">{String(kicker)}</span>
              <h3 className="mb-4 text-2xl font-black leading-tight text-kv-navy md:text-3xl">{String(title)}</h3>
              <p className="mb-4 leading-relaxed text-kv-muted">{String(text)}</p>
              <ul className="space-y-2 text-sm font-semibold text-kv-ink">
                {(items as string[]).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-14" id="process" aria-labelledby="process-title">
        <div className="mx-auto max-w-kv-container px-5">
          <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">{t.processKicker}</span>
              <h2 id="process-title" className="text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">{t.processTitle}</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-kv-muted">{t.processText}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {t.process.map(([label, title, text]) => (
              <article key={label} className="rounded-kv-main border border-kv-line bg-kv-bg p-5">
                <span className="text-sm font-black uppercase tracking-widest text-kv-red">{label}</span>
                <h3 className="mt-3 text-xl font-bold text-kv-navy">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-kv-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-kv-navy py-12 text-white" aria-labelledby="cta-title">
        <div className="mx-auto grid max-w-kv-container gap-7 px-5 lg:grid-cols-[1.2fr,0.8fr] lg:items-center">
          <div>
            <h2 id="cta-title" className="text-3xl font-black leading-tight md:text-5xl">{t.ctaTitle}</h2>
            <p className="mt-4 max-w-2xl text-white/72">{t.ctaText}</p>
          </div>
          <form className="rounded-kv-main border border-white/16 bg-white/10 p-5 backdrop-blur-xl">
            <input type="tel" placeholder={t.phone} className="mb-3 h-11 w-full rounded-kv-form bg-white px-3.5 text-sm text-kv-ink outline-none" />
            <textarea placeholder={t.task} className="mb-3 min-h-[92px] w-full rounded-kv-form bg-white px-3.5 py-3 text-sm text-kv-ink outline-none" />
            <button type="submit" className="w-full rounded-full bg-kv-red px-5 py-3 font-extrabold text-white hover:bg-kv-red-dark">{t.submit}</button>
          </form>
        </div>
      </section>

      <section className="bg-white py-12" id="contacts" aria-labelledby="contacts-title">
        <div className="mx-auto max-w-kv-container px-5">
          <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">{t.contactsKicker}</span>
              <h2 id="contacts-title" className="text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">{t.contactsTitle}</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-kv-muted">{t.contactsText}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[0.9fr,1.1fr]">
            <div className="rounded-kv-main border border-kv-line bg-kv-bg p-5">
              <ul className="space-y-3 text-sm">
                <li><span className="block text-kv-muted">{t.phone}</span><a href="tel:+79772919573" className="font-bold text-kv-navy">+7 (977) 291-95-73</a></li>
                <li><span className="block text-kv-muted">Email</span><a href="mailto:info@kvartal-pro.ru" className="font-bold text-kv-navy">info@kvartal-pro.ru</a></li>
                <li>
                  <span className="block text-kv-muted">{t.office}</span>
                  <strong className="text-kv-navy">
                    {language === "ru" ? "107113, Москва, Сокольническая площадь, д. 4А, пом. 34/3" : "107113, Moscow, Sokolnicheskaya Square, 4A, room 34/3"}
                  </strong>
                </li>
                <li><span className="block text-kv-muted">{t.messengers}</span><strong className="text-kv-navy">Telegram / WhatsApp</strong></li>
              </ul>
            </div>
            <div className="rounded-kv-main border border-kv-line bg-[linear-gradient(135deg,#071d3a,#173c6b)] p-5 text-white">
              <h3 className="text-xl font-black">{t.mapTitle}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">{t.mapText}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
