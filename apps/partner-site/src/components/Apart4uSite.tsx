"use client";

import { useMemo, useState } from "react";

import type { PartnerInventoryItem, PartnerTenantConfig } from "../tenants";

type Apart4uSiteProps = {
  tenant: PartnerTenantConfig;
  inventory: PartnerInventoryItem[];
};

type Language = "ru" | "en" | "ka";

type TextMap = Record<Language, Record<string, string>>;

const texts: TextMap = {
  ru: {
    navHome: "Главная",
    navProperties: "Объекты",
    navInvest: "Инвестиции",
    navServices: "Услуги",
    navAbout: "О компании",
    navContacts: "Контакты",
    contact: "Связаться",
    claim: "Ваш надежный партнер на рынке недвижимости Тбилиси",
    viewObjects: "Смотреть объекты",
    consultation: "Получить консультацию",
    why: "Почему Apart4U",
    whyTitle: "Премиальный подход к недвижимости в Тбилиси",
    whyOne: "Подбор проверенных объектов в лучших районах Тбилиси.",
    whyTwo: "Индивидуальная работа с каждым клиентом и точный подбор под задачу.",
    whyThree: "Объекты с понятным инвестиционным потенциалом и арендным спросом.",
    whyFour: "Знание районов, цен, юридических процедур и локального рынка.",
    properties: "Объекты",
    propertiesTitle: "Недвижимость для жизни и инвестиций",
    allTypes: "Все типы",
    allMarkets: "Все рынки",
    allCountries: "Все страны",
    investEyebrow: "Инвестиции",
    investTitle: "Invest in Tbilisi Real Estate",
    investText:
      "Подбираем объекты для аренды, роста капитала и долгосрочного владения. Сопровождаем клиента от стратегии покупки до управления объектом.",
    discussInvestment: "Обсудить инвестицию",
    services: "Услуги",
    servicesTitle: "Полное сопровождение сделки",
    about: "О компании",
    aboutText:
      "Apart4U - агентство недвижимости в Тбилиси, которое помогает клиентам находить премиальные апартаменты, инвестиционные объекты и надежные решения на рынке недвижимости Грузии.",
    process: "Процесс",
    processTitle: "Как мы работаем",
    testimonials: "Отзывы",
    testimonialsTitle: "Клиенты о работе с Apart4U",
    contacts: "Контакты",
    contactsTitle: "Оставьте заявку",
    contactsText: "Опишите задачу: покупка, аренда, продажа или инвестиционный подбор. Мы свяжемся с вами.",
    noObjects: "Нет объектов по выбранным фильтрам.",
    price: "Цена",
    area: "Площадь",
    details: "Подробнее",
    source: "Общая витрина Fixer.guru",
    seller: "Сторона продавца",
    buyer: "Сторона покупателя",
    formStatus: "Форма готова к подключению lead endpoint / Deal Room.",
  },
  en: {
    navHome: "Home",
    navProperties: "Properties",
    navInvest: "Investments",
    navServices: "Services",
    navAbout: "About",
    navContacts: "Contacts",
    contact: "Contact",
    claim: "Your trusted partner in Tbilisi real estate",
    viewObjects: "View properties",
    consultation: "Get consultation",
    why: "Why Apart4U",
    whyTitle: "Premium real estate approach in Tbilisi",
    whyOne: "Verified properties in the best districts of Tbilisi.",
    whyTwo: "Personal work with every client and precise selection.",
    whyThree: "Properties with clear investment potential and rental demand.",
    whyFour: "Knowledge of districts, prices, legal procedures and local market.",
    properties: "Properties",
    propertiesTitle: "Real estate for living and investments",
    allTypes: "All types",
    allMarkets: "All markets",
    allCountries: "All countries",
    investEyebrow: "Investments",
    investTitle: "Invest in Tbilisi Real Estate",
    investText:
      "We select properties for rental income, capital growth and long-term ownership. We support clients from purchase strategy to property management.",
    discussInvestment: "Discuss investment",
    services: "Services",
    servicesTitle: "Full transaction support",
    about: "About",
    aboutText:
      "Apart4U is a real estate agency based in Tbilisi, helping clients find premium apartments, investment properties and reliable solutions in the Georgian property market.",
    process: "Process",
    processTitle: "How we work",
    testimonials: "Testimonials",
    testimonialsTitle: "Clients about Apart4U",
    contacts: "Contacts",
    contactsTitle: "Send a request",
    contactsText: "Describe your goal: purchase, rent, sale or investment selection. We will contact you.",
    noObjects: "No objects match the selected filters.",
    price: "Price",
    area: "Area",
    details: "Details",
    source: "Fixer.guru shared inventory",
    seller: "Seller side",
    buyer: "Buyer side",
    formStatus: "Form is ready for lead endpoint / Deal Room integration.",
  },
  ka: {
    navHome: "მთავარი",
    navProperties: "ობიექტები",
    navInvest: "ინვესტიცია",
    navServices: "სერვისები",
    navAbout: "ჩვენ შესახებ",
    navContacts: "კონტაქტი",
    contact: "კონტაქტი",
    claim: "თქვენი სანდო პარტნიორი თბილისის უძრავ ქონებაში",
    viewObjects: "ობიექტების ნახვა",
    consultation: "კონსულტაცია",
    why: "რატომ Apart4U",
    whyTitle: "პრემიუმ მიდგომა თბილისის უძრავ ქონებაში",
    whyOne: "შემოწმებული ობიექტები თბილისის საუკეთესო უბნებში.",
    whyTwo: "ინდივიდუალური მუშაობა თითოეულ კლიენტთან.",
    whyThree: "ობიექტები საინვესტიციო პოტენციალით და ქირავნობის მოთხოვნით.",
    whyFour: "უბნების, ფასების, იურიდიული პროცედურებისა და ბაზრის ცოდნა.",
    properties: "ობიექტები",
    propertiesTitle: "უძრავი ქონება ცხოვრებისა და ინვესტიციისთვის",
    allTypes: "ყველა ტიპი",
    allMarkets: "ყველა ბაზარი",
    allCountries: "ყველა ქვეყანა",
    investEyebrow: "ინვესტიცია",
    investTitle: "Invest in Tbilisi Real Estate",
    investText: "ვარჩევთ ობიექტებს ქირავნობის შემოსავლის, კაპიტალის ზრდისა და გრძელვადიანი ფლობისთვის.",
    discussInvestment: "ინვესტიციის განხილვა",
    services: "სერვისები",
    servicesTitle: "გარიგების სრული მხარდაჭერა",
    about: "ჩვენ შესახებ",
    aboutText:
      "Apart4U არის უძრავი ქონების სააგენტო თბილისში, რომელიც ეხმარება კლიენტებს პრემიუმ აპარტამენტებისა და საინვესტიციო ობიექტების მოძიებაში.",
    process: "პროცესი",
    processTitle: "როგორ ვმუშაობთ",
    testimonials: "შეფასებები",
    testimonialsTitle: "კლიენტები Apart4U-ზე",
    contacts: "კონტაქტი",
    contactsTitle: "დატოვეთ მოთხოვნა",
    contactsText: "აღწერეთ თქვენი მიზანი: ყიდვა, ქირა, გაყიდვა ან ინვესტიცია. ჩვენ დაგიკავშირდებით.",
    noObjects: "არჩეული ფილტრებით ობიექტები არ მოიძებნა.",
    price: "ფასი",
    area: "ფართობი",
    details: "დეტალები",
    source: "Fixer.guru საერთო ვიტრინა",
    seller: "გამყიდველის მხარე",
    buyer: "მყიდველის მხარე",
    formStatus: "ფორმა მზად არის lead endpoint / Deal Room ინტეგრაციისთვის.",
  },
};

const advantages = [
  ["Premium Properties", "whyOne"],
  ["Personal Approach", "whyTwo"],
  ["Profitable Investments", "whyThree"],
  ["Local Expertise", "whyFour"],
] as const;

const services = [
  ["Покупка недвижимости", "Property purchase", "ქონების ყიდვა"],
  ["Продажа недвижимости", "Property sale", "ქონების გაყიდვა"],
  ["Аренда апартаментов", "Apartment rental", "აპარტამენტის ქირა"],
  ["Инвестиционный подбор", "Investment selection", "საინვესტიციო შერჩევა"],
  ["Юридическое сопровождение", "Legal support", "იურიდიული მხარდაჭერა"],
  ["Управление недвижимостью", "Property management", "ქონების მართვა"],
] as const;

const serviceDescriptions = [
  ["Подбор, проверка и организация сделки.", "Selection, verification and transaction organization.", "შერჩევა, შემოწმება და გარიგების ორგანიზება."],
  ["Упаковка объекта, реклама и переговоры.", "Property packaging, advertising and negotiations.", "ობიექტის შეფუთვა, რეკლამა და მოლაპარაკებები."],
  ["Подбор жилья и проверка условий аренды.", "Housing selection and lease terms review.", "საცხოვრებლის შერჩევა და პირობების შემოწმება."],
  ["Анализ района, цены и доходности.", "District, price and yield analysis.", "უბნის, ფასისა და შემოსავლიანობის ანალიზი."],
  ["Проверка документов и сопровождение регистрации.", "Document check and registration support.", "დოკუმენტების შემოწმება და რეგისტრაცია."],
  ["Арендаторы, обслуживание и отчетность.", "Tenants, maintenance and reporting.", "მოიჯარეები, მომსახურება და ანგარიშგება."],
] as const;

const languageIndex = { ru: 0, en: 1, ka: 2 } satisfies Record<Language, number>;

function getAssetLabel(assetClass?: string) {
  if (!assetClass) {
    return "property";
  }
  return assetClass.replace(/_/g, " ");
}

function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }
  if (url.startsWith("/api/")) {
    return url;
  }
  return url;
}

export function Apart4uSite({ tenant, inventory }: Apart4uSiteProps) {
  const [language, setLanguage] = useState<Language>("ru");
  const [typeFilter, setTypeFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedObject, setSelectedObject] = useState<PartnerInventoryItem | null>(null);
  const t = texts[language];
  const langIndex = languageIndex[language];

  const types = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.assetClass).filter(Boolean))) as string[],
    [inventory],
  );
  const markets = useMemo(() => Array.from(new Set(inventory.map((item) => item.market).filter(Boolean))), [inventory]);
  const countries = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.country).filter(Boolean))) as string[],
    [inventory],
  );

  const filteredInventory = inventory.filter((item) => {
    return (
      (typeFilter === "all" || item.assetClass === typeFilter) &&
      (marketFilter === "all" || item.market === marketFilter) &&
      (countryFilter === "all" || item.country === countryFilter)
    );
  });

  return (
    <main className="apart-site">
      <header className="apart-header">
        <a className="apart-brand" href="#hero" aria-label="Apart4U home">
          <span className="apart-brand-mark">A4U</span>
          <span>
            Apart<span>4U</span>
          </span>
        </a>
        <nav className="apart-nav">
          <a href="#hero">{t.navHome}</a>
          <a href="#properties">{t.navProperties}</a>
          <a href="#invest">{t.navInvest}</a>
          <a href="#services">{t.navServices}</a>
          <a href="#about">{t.navAbout}</a>
          <a href="#contacts">{t.navContacts}</a>
        </nav>
        <div className="apart-header-actions">
          <div className="apart-lang" aria-label="Language switcher">
            {(["ru", "en", "ka"] as const).map((item) => (
              <button key={item} className={language === item ? "active" : ""} type="button" onClick={() => setLanguage(item)}>
                {item === "ka" ? "GE" : item.toUpperCase()}
              </button>
            ))}
          </div>
          <a className="apart-header-cta" href="#contacts">
            {t.contact}
          </a>
        </div>
      </header>

      <section className="apart-hero apart-section" id="hero">
        <img className="apart-hero-bg" src={tenant.heroImage ?? "/apart4u/Apart4Upic.jpeg"} alt="Apart4U Tbilisi" />
        <div className="apart-hero-overlay" />
        <div className="apart-hero-panel" />
        <div className="apart-hero-content">
          <p className="apart-eyebrow">APARTMENTS&nbsp;&nbsp; INVESTMENTS&nbsp;&nbsp; REAL SOLUTIONS</p>
          <div className="apart-gold-line" />
          <div className="apart-logo-large">Apart4U</div>
          <h1>
            Apart<span>4U</span>
          </h1>
          <p className="apart-subtitle">REAL ESTATE AGENCY</p>
          <p className="apart-location">TBILISI</p>
          <p className="apart-claim">{t.claim}</p>
          <div className="apart-hero-buttons">
            <a className="apart-btn primary" href="#properties">
              {t.viewObjects}
            </a>
            <a className="apart-btn ghost" href="#contacts">
              {t.consultation}
            </a>
          </div>
        </div>
        <div className="apart-hero-benefits">
          {tenant.strengths.map((item) => (
            <article key={item}>
              <span className="apart-icon">◇</span>
              <b>{item}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="apart-section apart-advantages">
        <div className="apart-section-head">
          <p className="apart-eyebrow">{t.why}</p>
          <h2>{t.whyTitle}</h2>
        </div>
        <div className="apart-grid four">
          {advantages.map(([title, key]) => (
            <article className="apart-card" key={title}>
              <span className="apart-card-icon">◇</span>
              <h3>{title}</h3>
              <p>{t[key]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="apart-section apart-properties" id="properties">
        <div className="apart-section-head">
          <p className="apart-eyebrow">{t.properties}</p>
          <h2>{t.propertiesTitle}</h2>
        </div>
        <div className="apart-filters">
          <select aria-label="Object type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">{t.allTypes}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {getAssetLabel(type)}
              </option>
            ))}
          </select>
          <select aria-label="Market" value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)}>
            <option value="all">{t.allMarkets}</option>
            {markets.map((market) => (
              <option key={market} value={market}>
                {market}
              </option>
            ))}
          </select>
          <select aria-label="Country" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
            <option value="all">{t.allCountries}</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
        <div className="apart-property-grid">
          {filteredInventory.length ? (
            filteredInventory.map((item) => {
              const mediaUrl = resolveMediaUrl(item.mediaUrl);
              return (
                <article className="apart-property-card" key={item.id ?? `${item.market}-${item.title}`}>
                  <div className="apart-photo">
                    {mediaUrl ? <img src={mediaUrl} alt={item.title} loading="lazy" /> : <div className="apart-photo-placeholder">Apart4U</div>}
                    <span className="apart-badge">{getAssetLabel(item.assetClass)}</span>
                  </div>
                  <div className="apart-property-body">
                    <p className="apart-meta-line">{item.market}</p>
                    <h3>{item.title}</h3>
                    <div className="apart-price">{item.priceDisplay ?? "On request"}</div>
                    <div className="apart-specs">
                      <span>{item.addressDisplay ?? item.city ?? item.market}</span>
                      {item.areaSqm ? <span>{item.areaSqm} m²</span> : null}
                      <span>{t.source}</span>
                    </div>
                    <p className="apart-card-desc">{item.description ?? `${t.seller}: ${item.sellerSidePartner}`}</p>
                    <div className="apart-property-actions">
                      <button className="apart-btn ghost" type="button" onClick={() => setSelectedObject(item)}>
                        {t.details}
                      </button>
                      <a className="apart-btn primary" href="#contacts">
                        {t.contact}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="apart-empty">{t.noObjects}</p>
          )}
        </div>
      </section>

      <section className="apart-section apart-invest" id="invest">
        <div className="apart-split">
          <div>
            <p className="apart-eyebrow">{t.investEyebrow}</p>
            <h2>{t.investTitle}</h2>
            <p>{t.investText}</p>
            <a className="apart-btn primary" href="#contacts">
              {t.discussInvestment}
            </a>
          </div>
          <div className="apart-stats">
            {["Rental Income", "Capital Growth", "Legal Support", "Full Management"].map((item) => {
              const [strong, ...rest] = item.split(" ");
              return (
                <article key={item}>
                  <strong>{strong}</strong>
                  <span>{rest.join(" ")}</span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="apart-section apart-services" id="services">
        <div className="apart-section-head">
          <p className="apart-eyebrow">{t.services}</p>
          <h2>{t.servicesTitle}</h2>
        </div>
        <div className="apart-grid three">
          {services.map((service, index) => (
            <article className="apart-card" key={service[1]}>
              <h3>{service[langIndex]}</h3>
              <p>{serviceDescriptions[index][langIndex]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="apart-section apart-about" id="about">
        <div className="apart-split">
          <div className="apart-about-image" />
          <div className="apart-about-card">
            <p className="apart-eyebrow">{t.about}</p>
            <h2>Apart4U</h2>
            <p>{t.aboutText}</p>
            <ul>
              <li>Local market expertise</li>
              <li>Verified properties</li>
              <li>Personal assistance</li>
              <li>English / Russian / Georgian support</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="apart-section apart-process">
        <div className="apart-section-head">
          <p className="apart-eyebrow">{t.process}</p>
          <h2>{t.processTitle}</h2>
        </div>
        <div className="apart-timeline">
          {["Consultation", "Property Selection", "Viewing / Online Tour", "Legal Check", "Deal Closing", "After-sale Support"].map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="apart-section apart-testimonials">
        <div className="apart-section-head">
          <p className="apart-eyebrow">{t.testimonials}</p>
          <h2>{t.testimonialsTitle}</h2>
        </div>
        <div className="apart-testimonial">
          <p>Команда быстро подобрала квартиру в Vake, проверила документы и сопровождала сделку до регистрации.</p>
          <div>
            <strong>Anna K.</strong>
            <span> Germany</span>
          </div>
          <b className="apart-stars">★★★★★</b>
        </div>
      </section>

      <section className="apart-section apart-contacts" id="contacts">
        <div className="apart-split">
          <div>
            <p className="apart-eyebrow">{t.contacts}</p>
            <h2>{t.contactsTitle}</h2>
            <p>{t.contactsText}</p>
            <div className="apart-contact-links">
              <a href="https://wa.me/995555000000" target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              <a href="https://t.me/apart4u" target="_blank" rel="noreferrer">
                Telegram
              </a>
              <a href="mailto:info@apart4u.ge">Email</a>
            </div>
          </div>
          <form className="apart-contact-form" onSubmit={(event) => event.preventDefault()}>
            <input name="name" placeholder={language === "en" ? "Name" : language === "ka" ? "სახელი" : "Имя"} required />
            <input name="phone" placeholder={language === "en" ? "Phone" : language === "ka" ? "ტელეფონი" : "Телефон"} />
            <input name="email" type="email" placeholder="Email" />
            <select name="interest" required>
              <option value="">{language === "en" ? "Interest" : language === "ka" ? "ინტერესი" : "Интерес"}</option>
              <option>{language === "en" ? "Purchase" : language === "ka" ? "ყიდვა" : "Покупка"}</option>
              <option>{language === "en" ? "Rent" : language === "ka" ? "ქირა" : "Аренда"}</option>
              <option>{language === "en" ? "Investments" : language === "ka" ? "ინვესტიცია" : "Инвестиции"}</option>
              <option>{language === "en" ? "Sale" : language === "ka" ? "გაყიდვა" : "Продажа"}</option>
            </select>
            <input name="budget" placeholder={language === "en" ? "Budget" : language === "ka" ? "ბიუჯეტი" : "Бюджет"} />
            <textarea name="message" placeholder={language === "en" ? "Message" : language === "ka" ? "შეტყობინება" : "Сообщение"} />
            <button className="apart-btn primary" type="submit" onClick={(event) => {
              const form = event.currentTarget.form;
              const status = form?.querySelector<HTMLParagraphElement>(".apart-form-status");
              if (status) {
                status.textContent = t.formStatus;
              }
            }}>
              Send Request
            </button>
            <p className="apart-form-status" />
          </form>
        </div>
        <div className="apart-map">Tbilisi, Georgia</div>
      </section>

      <footer className="apart-footer">
        <div className="apart-brand">
          <span className="apart-brand-mark">A4U</span>
          <span>
            Apart<span>4U</span>
          </span>
        </div>
        <p>Premium apartments, profitable investments and real estate solutions in Tbilisi.</p>
        <p>© 2026 Apart4U Real Estate Agency. Powered by Fixer.guru partner network.</p>
      </footer>

      {selectedObject ? (
        <div className="apart-modal open" aria-hidden="false" onClick={() => setSelectedObject(null)}>
          <div className="apart-modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="apart-modal-close" type="button" onClick={() => setSelectedObject(null)}>
              ×
            </button>
            {resolveMediaUrl(selectedObject.mediaUrl) ? <img src={resolveMediaUrl(selectedObject.mediaUrl) ?? ""} alt={selectedObject.title} /> : null}
            <h3>{selectedObject.title}</h3>
            <p>{`${selectedObject.market} • ${selectedObject.priceDisplay ?? "On request"}${selectedObject.areaSqm ? ` • ${selectedObject.areaSqm} m²` : ""}`}</p>
            <p>{selectedObject.description}</p>
            <p>
              {t.seller}: {selectedObject.sellerSidePartner}
              <br />
              {t.buyer}: {selectedObject.buyerSidePartner}
            </p>
            <a className="apart-btn primary" href="#contacts" onClick={() => setSelectedObject(null)}>
              {t.contact}
            </a>
          </div>
        </div>
      ) : null}
    </main>
  );
}
