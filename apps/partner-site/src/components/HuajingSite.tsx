"use client";

import { FormEvent, useMemo, useState } from "react";

import type { PartnerInventoryByLanguage, PartnerInventoryItem, PartnerTenantConfig } from "../tenants";

type HuajingSiteProps = {
  tenant: PartnerTenantConfig;
  inventoryByLanguage: PartnerInventoryByLanguage;
};

type Copy = {
  nav: string[];
  consult: string;
  heroKicker: string;
  heroTitle: string;
  heroText: string;
  primary: string;
  secondary: string;
  searchTitle: string;
  filters: string[];
  metrics: string[][];
  trust: string[][];
  aboutKicker: string;
  aboutTitle: string;
  aboutText: string;
  listingsKicker: string;
  listingsTitle: string;
  listingsText: string;
  allMarkets: string;
  allTypes: string;
  details: string;
  enquire: string;
  locationKicker: string;
  locationTitle: string;
  locationText: string;
  teamKicker: string;
  teamTitle: string;
  aiKicker: string;
  aiTitle: string;
  aiText: string;
  roi: string;
  leadKicker: string;
  leadTitle: string;
  leadText: string;
  form: {
    name: string;
    contact: string;
    wechat: string;
    message: string;
    submit: string;
    sending: string;
    success: string;
    error: string;
  };
  review: string;
};

const copy: Record<"zh" | "en" | "ru", Copy> = {
  zh: {
    nav: ["项目", "城市", "团队", "AI"],
    consult: "预约咨询",
    heroKicker: "Fixer.guru partner network",
    heroTitle: "面向中国客户的全球高端资产顾问",
    heroText: "华境置业将中国核心城市与迪拜、新加坡、东京等海外市场放入同一个严谨的筛选流程：需求访谈、资产初筛、资料复核与经纪人执行。",
    primary: "获取私人清单",
    secondary: "浏览项目",
    searchTitle: "快速建立需求",
    filters: ["区域", "预算", "目标"],
    metrics: [
      ["6", "精选展示项目"],
      ["3", "工作语言"],
      ["24h", "初步反馈"],
    ],
    trust: [
      ["资料复核流程", "每个展示项目均进入经纪人资料检查与后续法律审阅流程。"],
      ["跨境沟通", "中文、英文、俄文团队可承接境内与海外买方需求。"],
      ["平台化记录", "需求、对象与跟进状态进入 Fixer.guru 伙伴流程。"],
    ],
    aboutKicker: "关于华境",
    aboutTitle: "把高端房产搜索做成可追踪的决策流程。",
    aboutText: "我们不承诺收益，也不替代法律意见。华境置业负责把客户目标、城市选择、预算、风险偏好和可看项目整理成可执行的经纪人工作流。",
    listingsKicker: "精选项目",
    listingsTitle: "中国与全球核心城市的 curated shortlist。",
    listingsText: "若平台 API 有对象数据，页面会优先展示共享库存；否则展示 HUAJING showcase 数据。",
    allMarkets: "全部城市",
    allTypes: "全部类型",
    details: "查看详情",
    enquire: "咨询此项目",
    locationKicker: "城市网络",
    locationTitle: "从上海办公室连接中国与海外市场。",
    locationText: "上海、深圳、杭州作为本地起点，迪拜、新加坡、东京作为跨境配置路径。",
    teamKicker: "顾问团队",
    teamTitle: "面向买方、投资人与家庭办公室的协调服务。",
    aiKicker: "AI assisted",
    aiTitle: "AI 只做整理，判断仍由经纪人与专业顾问完成。",
    aiText: "页面会把预算、城市、目标与留言整理成结构化需求，提交到平台 client intent。",
    roi: "收益场景估算",
    leadKicker: "开始需求",
    leadTitle: "发送你的城市、预算与时间表。",
    leadText: "我们会准备初步清单与下一步沟通建议。资料与交易条件以正式文件审阅为准。",
    form: {
      name: "姓名",
      contact: "电话 / Email",
      wechat: "WeChat",
      message: "需求说明",
      submit: "提交需求",
      sending: "提交中...",
      success: "需求已提交，顾问会跟进。",
      error: "暂时无法提交，请稍后再试或直接联系 contact@huajing.estate。",
    },
    review: "需文件与法律审阅",
  },
  en: {
    nav: ["Listings", "Cities", "Team", "AI"],
    consult: "Book consult",
    heroKicker: "Fixer.guru partner network",
    heroTitle: "Global real estate advisory for China-market clients",
    heroText: "HUAJING connects prime China locations with Dubai, Singapore and Tokyo through one structured workflow: client brief, curated shortlist, document review and broker execution.",
    primary: "Request private shortlist",
    secondary: "Explore listings",
    searchTitle: "Build a quick brief",
    filters: ["Region", "Budget", "Objective"],
    metrics: [
      ["6", "showcase assets"],
      ["3", "working languages"],
      ["24h", "first response target"],
    ],
    trust: [
      ["Review workflow", "Showcase objects enter broker-side document checks and further legal review."],
      ["Cross-border desk", "Chinese, English and Russian communication for local and overseas buyer briefs."],
      ["Platform records", "Requests, objects and follow-ups are routed into the Fixer.guru partner workflow."],
    ],
    aboutKicker: "About HUAJING",
    aboutTitle: "Turning premium property search into a trackable decision process.",
    aboutText: "We do not guarantee returns and do not replace legal advice. HUAJING structures goals, market selection, budget, risk profile and available objects into a broker-ready workflow.",
    listingsKicker: "Featured assets",
    listingsTitle: "A curated shortlist across China and core global cities.",
    listingsText: "The page uses shared platform inventory when available and HUAJING showcase data as fallback.",
    allMarkets: "All cities",
    allTypes: "All types",
    details: "View details",
    enquire: "Enquire",
    locationKicker: "City network",
    locationTitle: "A Shanghai desk connected to China and overseas markets.",
    locationText: "Shanghai, Shenzhen and Hangzhou form the local base; Dubai, Singapore and Tokyo support cross-border allocation briefs.",
    teamKicker: "Advisory team",
    teamTitle: "Coordinated support for buyers, investors and family offices.",
    aiKicker: "AI assisted",
    aiTitle: "AI structures the brief; brokers and advisors make the judgment.",
    aiText: "Budget, city, objective and notes are converted into a structured platform client intent.",
    roi: "Scenario estimate",
    leadKicker: "Start a brief",
    leadTitle: "Send your city, budget and timing.",
    leadText: "We prepare an initial shortlist and next-step recommendations. Documents and terms require formal review.",
    form: {
      name: "Name",
      contact: "Phone / Email",
      wechat: "WeChat",
      message: "Requirement",
      submit: "Submit brief",
      sending: "Submitting...",
      success: "Brief submitted. An advisor will follow up.",
      error: "Unable to submit right now. Try later or contact contact@huajing.estate.",
    },
    review: "Document and legal review required",
  },
  ru: {
    nav: ["Объекты", "Города", "Команда", "AI"],
    consult: "Консультация",
    heroKicker: "Fixer.guru partner network",
    heroTitle: "Глобальный подбор недвижимости для клиентов китайского рынка",
    heroText: "HUAJING соединяет Китай, Дубай, Сингапур и Токио в одном процессе: бриф клиента, подобранный список объектов, проверка материалов и работа брокера.",
    primary: "Получить подборку",
    secondary: "Смотреть объекты",
    searchTitle: "Собрать быстрый бриф",
    filters: ["Регион", "Бюджет", "Цель"],
    metrics: [
      ["6", "showcase-объектов"],
      ["3", "рабочих языка"],
      ["24h", "первичный ответ"],
    ],
    trust: [
      ["Процесс проверки", "Объекты проходят брокерскую проверку материалов и требуют отдельную юридическую проверку."],
      ["Международная команда", "Китайский, английский и русский для локальных и зарубежных запросов покупателей."],
      ["Платформенный учет", "Заявки, объекты и сопровождение идут через рабочий процесс Fixer.guru partner network."],
    ],
    aboutKicker: "О HUAJING",
    aboutTitle: "Премиальный поиск недвижимости как управляемый процесс принятия решения.",
    aboutText: "Мы не гарантируем доходность и не заменяем юридическую консультацию. HUAJING структурирует цели, рынки, бюджет, риск-профиль и доступные объекты в рабочий процесс брокера.",
    listingsKicker: "Подборка",
    listingsTitle: "Curated shortlist по Китаю и ключевым глобальным городам.",
    listingsText: "Если API платформы возвращает объекты, сайт использует shared inventory; иначе показывает HUAJING showcase данные.",
    allMarkets: "Все города",
    allTypes: "Все типы",
    details: "Подробнее",
    enquire: "Запросить",
    locationKicker: "Городская сеть",
    locationTitle: "Шанхайский офис с доступом к Китаю и зарубежным рынкам.",
    locationText: "Шанхай, Шэньчжэнь и Ханчжоу как локальная база; Дубай, Сингапур и Токио для международных задач.",
    teamKicker: "Команда",
    teamTitle: "Координация для покупателей, инвесторов и семейных офисов.",
    aiKicker: "AI assisted",
    aiTitle: "AI структурирует бриф; решение остается за брокером и профильными консультантами.",
    aiText: "Бюджет, город, цель и комментарий превращаются в структурированный client intent платформы.",
    roi: "Сценарная оценка",
    leadKicker: "Начать бриф",
    leadTitle: "Отправьте город, бюджет и сроки.",
    leadText: "Мы подготовим первичный shortlist и рекомендации по следующему шагу. Документы и условия требуют формальной проверки.",
    form: {
      name: "Имя",
      contact: "Телефон / Email",
      wechat: "WeChat",
      message: "Описание запроса",
      submit: "Отправить бриф",
      sending: "Отправляем...",
      success: "Бриф отправлен. Консультант свяжется с вами.",
      error: "Сейчас не удалось отправить. Попробуйте позже или напишите на contact@huajing.estate.",
    },
    review: "Требуется документальная и юридическая проверка",
  },
};

const localizedUi = {
  zh: {
    brand: "华境置业",
    mark: "境",
    seal: "华境",
    searchValues: ["上海 / 迪拜 / 新加坡", "¥5M - ¥25M+", "自住 / 投资 / 迁居"],
    previewLive: "实时预览",
    previewCaption: "精选资产预览",
    previewTitle: "滨江云邸",
    previewMeta: "上海 · 黄浦滨江 · 私享看房",
    budgetLabel: "预算",
    sqm: "平方米",
    onRequest: "价格待询",
    powered: "由 Fixer.guru partner network 提供技术支持",
    cities: ["上海", "深圳", "杭州", "迪拜", "新加坡", "东京"],
    advisors: [
      ["李伟", "中国买方顾问", "上海 / 深圳"],
      ["陈安娜", "跨境资产配置", "迪拜 / 新加坡"],
      ["米哈伊尔", "伙伴网络协调", "中文 / 英文 / 俄文"],
    ],
    assetLabels: {
      apartment: "公寓",
      house: "住宅",
      investment_project: "投资项目",
      development_project: "开发项目",
      property: "物业",
    },
  },
  en: {
    brand: "HUAJING Estate",
    mark: "境",
    seal: "HUAJING",
    searchValues: ["Shanghai / Dubai / Singapore", "¥5M - ¥25M+", "Residence / Investment / Relocation"],
    previewLive: "Live preview",
    previewCaption: "Curated asset preview",
    previewTitle: "Riverside Cloud Residence",
    previewMeta: "Shanghai · Huangpu Riverside · Private viewing",
    budgetLabel: "Budget",
    sqm: "sqm",
    onRequest: "On request",
    powered: "Powered by Fixer.guru partner network",
    cities: ["Shanghai", "Shenzhen", "Hangzhou", "Dubai", "Singapore", "Tokyo"],
    advisors: [
      ["Li Wei", "China buyer desk", "Shanghai / Shenzhen"],
      ["Anna Chen", "Cross-border investment", "Dubai / Singapore"],
      ["Mikhail Orlov", "Partner network", "ZH / EN / RU coordination"],
    ],
    assetLabels: {
      apartment: "Apartment",
      house: "Residence",
      investment_project: "Investment project",
      development_project: "Development project",
      property: "Property",
    },
  },
  ru: {
    brand: "HUAJING Estate",
    mark: "境",
    seal: "HUAJING",
    searchValues: ["Шанхай / Дубай / Сингапур", "¥5M - ¥25M+", "Жизнь / Инвестиции / Релокация"],
    previewLive: "Живое превью",
    previewCaption: "Превью подобранного объекта",
    previewTitle: "Резиденция Riverside Cloud",
    previewMeta: "Шанхай · набережная Хуанпу · приватный показ",
    budgetLabel: "Бюджет",
    sqm: "м²",
    onRequest: "По запросу",
    powered: "Работает на платформе Fixer.guru partner network",
    cities: ["Шанхай", "Шэньчжэнь", "Ханчжоу", "Дубай", "Сингапур", "Токио"],
    advisors: [
      ["Ли Вэй", "Китайский стол покупателей", "Шанхай / Шэньчжэнь"],
      ["Анна Чэнь", "Международные инвестиции", "Дубай / Сингапур"],
      ["Михаил Орлов", "Координация партнерской сети", "ZH / EN / RU"],
    ],
    assetLabels: {
      apartment: "Апартаменты",
      house: "Резиденция",
      investment_project: "Инвестпроект",
      development_project: "Девелопмент",
      property: "Объект",
    },
  },
} as const;

const marketLabels = {
  Shanghai: { zh: "上海", en: "Shanghai", ru: "Шанхай" },
  Shenzhen: { zh: "深圳", en: "Shenzhen", ru: "Шэньчжэнь" },
  Hangzhou: { zh: "杭州", en: "Hangzhou", ru: "Ханчжоу" },
  Dubai: { zh: "迪拜", en: "Dubai", ru: "Дубай" },
  Singapore: { zh: "新加坡", en: "Singapore", ru: "Сингапур" },
  Tokyo: { zh: "东京", en: "Tokyo", ru: "Токио" },
  China: { zh: "中国", en: "China", ru: "Китай" },
  CN: { zh: "中国", en: "China", ru: "Китай" },
  AE: { zh: "阿联酋", en: "UAE", ru: "ОАЭ" },
  SG: { zh: "新加坡", en: "Singapore", ru: "Сингапур" },
  JP: { zh: "日本", en: "Japan", ru: "Япония" },
} as const;

function assetLabel(value: string | undefined, language: "zh" | "en" | "ru") {
  const labels = localizedUi[language].assetLabels;

  return value ? labels[value as keyof typeof labels] ?? value.replace(/_/g, " ") : labels.property;
}

function localizeMarket(item: PartnerInventoryItem, language: "zh" | "en" | "ru") {
  const city = item.city ? marketLabels[item.city as keyof typeof marketLabels]?.[language] ?? item.city : null;
  const country = item.country ? marketLabels[item.country as keyof typeof marketLabels]?.[language] ?? item.country : null;

  if (city && country && city !== country) {
    return `${city}, ${country}`;
  }

  return city ?? item.market;
}

export function HuajingSite({ tenant, inventoryByLanguage }: HuajingSiteProps) {
  const [language, setLanguage] = useState<"zh" | "en" | "ru">("zh");
  const [market, setMarket] = useState("all");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<PartnerInventoryItem | null>(null);
  const [budget, setBudget] = useState(12);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const t = copy[language];
  const ui = localizedUi[language];
  const inventory = (inventoryByLanguage[language]?.length ? inventoryByLanguage[language] : tenant.inventory) as PartnerInventoryItem[];
  const markets = useMemo(() => Array.from(new Set(inventory.map((item) => localizeMarket(item, language)).filter(Boolean))), [inventory, language]);
  const types = useMemo(() => Array.from(new Set(inventory.map((item) => item.assetClass).filter(Boolean))) as string[], [inventory]);
  const filtered = inventory.filter((item) => (market === "all" || localizeMarket(item, language) === market) && (type === "all" || item.assetClass === type));
  const roi = Math.round(budget * 10000 * 0.038);

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get("message") ?? "").trim();
    const selectedTitle = selected ? `Selected object: ${selected.title}.` : "";
    const requirementText = [
      selectedTitle,
      `Language: ${language}.`,
      `Market filter: ${market}.`,
      `Type filter: ${type}.`,
      `Budget scenario: ¥${budget}M.`,
      message,
    ]
      .filter(Boolean)
      .join("\n");

    setStatus("sending");
    const response = await fetch("/api/client-intents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant: "huajing",
        preferredLanguage: language,
        preferredCurrency: "USD",
        clientName: String(form.get("name") ?? ""),
        clientContact: [form.get("contact"), form.get("wechat") ? `WeChat: ${form.get("wechat")}` : ""].filter(Boolean).join(" / "),
        requirementText,
        propertyObjectId: selected?.id,
        notes: `HUAJING public site lead from ${tenant.domainLabel}`,
      }),
    });

    setStatus(response.ok ? "success" : "error");

    if (response.ok) {
      event.currentTarget.reset();
    }
  }

  return (
    <main className="huajing-site">
      <header className="huajing-header">
        <a className="huajing-brand" href="#home" aria-label="HUAJING home">
          <span className="huajing-mark">{ui.mark}</span>
          <span>{ui.brand} <b>HUAJING</b></span>
        </a>
        <nav className="huajing-nav">
          <a href="#properties">{t.nav[0]}</a>
          <a href="#location">{t.nav[1]}</a>
          <a href="#team">{t.nav[2]}</a>
          <a href="#ai">{t.nav[3]}</a>
        </nav>
        <div className="huajing-actions">
          <div className="huajing-lang" aria-label="Language">
            {(["zh", "en", "ru"] as const).map((item) => (
              <button key={item} className={language === item ? "active" : ""} type="button" onClick={() => setLanguage(item)}>
                {item}
              </button>
            ))}
          </div>
          <a className="huajing-outline" href="#lead">
            {t.consult}
          </a>
        </div>
      </header>

      <section className="huajing-hero" id="home">
        <div className="huajing-architecture" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="huajing-hero-inner">
          <div className="huajing-hero-copy">
            <p className="huajing-eyebrow">{t.heroKicker}</p>
            <h1>{t.heroTitle}</h1>
            <p>{t.heroText}</p>
            <div className="huajing-search-panel" role="search" aria-label="Property search">
              {t.filters.map((label, index) => (
                <label key={label}>
                  <span>{label}</span>
                  <strong>{ui.searchValues[index]}</strong>
                </label>
              ))}
              <a className="huajing-primary gold" href="#lead">
                {t.primary}
              </a>
            </div>
            <div className="huajing-hero-buttons">
              <a className="huajing-outline dark" href="#properties">
                {t.secondary}
              </a>
            </div>
            <div className="huajing-metrics">
              {t.metrics.map(([value, label]) => (
                <span key={label}>
                  <b>{value}</b>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <aside className="huajing-media-stack" aria-label="Cinematic property preview">
            <div className="huajing-cinema-card">
              <div className="huajing-video-ui">
                <span className="huajing-recording">{ui.previewLive}</span>
                <div className="huajing-video-caption">
                  <p>{ui.previewCaption}</p>
                  <strong>{ui.previewTitle}</strong>
                  <span>{ui.previewMeta}</span>
                </div>
              </div>
            </div>
            <div className="huajing-floating-chip">
              <span>{ui.mark}</span>
              <div>
                <strong>{t.searchTitle}</strong>
                <small>{ui.searchValues[0]}</small>
              </div>
            </div>
            <div className="huajing-seal">{ui.seal}</div>
          </aside>
        </div>
      </section>

      <section className="huajing-trust">
        {t.trust.map(([title, text]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="huajing-section huajing-about">
        <div>
          <p className="huajing-eyebrow">{t.aboutKicker}</p>
          <h2>{t.aboutTitle}</h2>
        </div>
        <p>{t.aboutText}</p>
      </section>

      <section className="huajing-section huajing-listings" id="properties">
        <div className="huajing-section-head">
          <div>
            <p className="huajing-eyebrow">{t.listingsKicker}</p>
            <h2>{t.listingsTitle}</h2>
            <p>{t.listingsText}</p>
          </div>
          <div className="huajing-filters">
            <select value={market} onChange={(event) => setMarket(event.target.value)} aria-label={t.allMarkets}>
              <option value="all">{t.allMarkets}</option>
              {markets.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={type} onChange={(event) => setType(event.target.value)} aria-label={t.allTypes}>
              <option value="all">{t.allTypes}</option>
              {types.map((item) => (
                <option key={item} value={item}>
                  {assetLabel(item, language)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="huajing-property-grid">
          {filtered.map((item) => (
            <article className="huajing-property" key={item.id ?? `${item.market}-${item.title}`}>
              <div className="huajing-property-media">
                {item.mediaUrl ? <img src={item.mediaUrl} alt={item.title} loading="lazy" /> : <div className="huajing-generated-media">{item.city ?? "HUAJING"}</div>}
                <span>{t.review}</span>
              </div>
              <div className="huajing-property-body">
                <p>{localizeMarket(item, language)}</p>
                <h3>{item.title}</h3>
                <strong>{item.priceDisplay ?? ui.onRequest}</strong>
                <div className="huajing-chips">
                  <span>{assetLabel(item.assetClass, language)}</span>
                  {item.areaSqm ? <span>{item.areaSqm} {ui.sqm}</span> : null}
                  {item.addressDisplay ? <span>{item.addressDisplay}</span> : null}
                </div>
                <p>{item.description}</p>
                <button type="button" onClick={() => setSelected(item)}>
                  {t.details}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="huajing-section huajing-location" id="location">
        <div className="huajing-map">
          {ui.cities.map((city) => (
            <span key={city}>{city}</span>
          ))}
        </div>
        <div>
          <p className="huajing-eyebrow">{t.locationKicker}</p>
          <h2>{t.locationTitle}</h2>
          <p>{t.locationText}</p>
        </div>
      </section>

      <section className="huajing-section huajing-team" id="team">
        <div className="huajing-section-head compact">
          <p className="huajing-eyebrow">{t.teamKicker}</p>
          <h2>{t.teamTitle}</h2>
        </div>
        <div className="huajing-team-grid">
          {ui.advisors.map(([name, role, desk]) => (
            <article key={name}>
              <div>{name.split(" ").map((part) => part[0]).join("")}</div>
              <h3>{name}</h3>
              <p>{role}</p>
              <span>{desk}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="huajing-section huajing-ai" id="ai">
        <div>
          <p className="huajing-eyebrow">{t.aiKicker}</p>
          <h2>{t.aiTitle}</h2>
          <p>{t.aiText}</p>
        </div>
        <aside className="huajing-roi">
          <h3>{t.roi}</h3>
          <label>
            {ui.budgetLabel}: ¥{budget}M
            <input min="5" max="35" type="range" value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
          </label>
          <strong>~¥{roi.toLocaleString("en-US")}</strong>
          <p>{t.review}</p>
        </aside>
      </section>

      <section className="huajing-section huajing-lead" id="lead">
        <div>
          <p className="huajing-eyebrow">{t.leadKicker}</p>
          <h2>{t.leadTitle}</h2>
          <p>{t.leadText}</p>
          <div className="huajing-contact-lines">
            <span>contact@huajing.estate</span>
            <span>+86 21 5550 2026</span>
            <span>WeChat: HUAJING_ESTATE</span>
          </div>
        </div>
        <form className="huajing-form" onSubmit={submitLead}>
          <input name="name" placeholder={t.form.name} required />
          <input name="contact" placeholder={t.form.contact} required />
          <input name="wechat" placeholder={t.form.wechat} />
          <textarea name="message" placeholder={t.form.message} required />
          <button className="huajing-primary wide" disabled={status === "sending"} type="submit">
            {status === "sending" ? t.form.sending : t.form.submit}
          </button>
          <p className={status === "error" ? "error" : ""}>{status === "success" ? t.form.success : status === "error" ? t.form.error : t.review}</p>
        </form>
      </section>

      <footer className="huajing-footer">
        <div>
          <span className="huajing-mark">{ui.mark}</span>
          <b>{ui.brand} HUAJING Estate Partners</b>
        </div>
        <p>{ui.powered}. {tenant.domainLabel}</p>
      </footer>

      {selected ? (
        <div className="huajing-modal" role="dialog" aria-modal="true" aria-label={selected.title}>
          <div className="huajing-modal-card">
            <button className="huajing-modal-close" type="button" onClick={() => setSelected(null)} aria-label="Close">
              x
            </button>
            {selected.mediaUrl ? <img src={selected.mediaUrl} alt={selected.title} /> : null}
            <p className="huajing-eyebrow">{localizeMarket(selected, language)}</p>
            <h2>{selected.title}</h2>
            <strong>{selected.priceDisplay ?? ui.onRequest}</strong>
            <p>{selected.description}</p>
            <div className="huajing-chips">
              <span>{assetLabel(selected.assetClass, language)}</span>
              {selected.areaSqm ? <span>{selected.areaSqm} {ui.sqm}</span> : null}
              <span>{selected.sellerSidePartner}</span>
            </div>
            <a className="huajing-primary wide" href="#lead" onClick={() => setSelected(null)}>
              {t.enquire}
            </a>
          </div>
        </div>
      ) : null}
    </main>
  );
}
