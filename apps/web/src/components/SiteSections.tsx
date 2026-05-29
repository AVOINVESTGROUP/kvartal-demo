const services = [
  ["Подбор объекта", "Формируем короткий список объектов под назначение, бюджет, город, площадь, документы и требования к сделке."],
  ["Продажа и экспозиция", "Готовим объект к публикации, собираем обращения, квалифицируем спрос и ведем переговоры до сделки."],
  ["Инвестиционная оценка", "Сравниваем локацию, ликвидность, назначение, потенциал развития и сценарии доходности."],
  ["Сопровождение сделки", "Координируем переговоры, документы, проверку объекта, график платежей и выход на подписание."],
];

const process = [
  ["Шаг 1", "Бриф", "Фиксируем цель: покупка, аренда, продажа, инвестиции, требования к объекту и сроки."],
  ["Шаг 2", "Подбор", "Отбираем объекты по стране, городу, площади, назначению, документам и коммерческим условиям."],
  ["Шаг 3", "Проверка", "Уточняем актуальность данных, правовой контур, ограничения и готовим вопросы к стороне объекта."],
  ["Шаг 4", "Сделка", "Сопровождаем переговоры, согласование условий, документы и взаимодействие партнерских организаций."],
];

export const SiteSections = () => {
  return (
    <>
      <section className="bg-kv-bg py-20" id="services" aria-labelledby="services-title">
        <div className="mx-auto max-w-kv-container px-5">
          <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">Услуги</span>
              <h2 id="services-title" className="max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">
                Закрываем ключевые задачи по коммерческой недвижимости и инвестиционным объектам
              </h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-kv-muted">
              Сайт рассчитан на заявки от покупателей, инвесторов, арендаторов, собственников и партнерских офисов.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map(([title, text], index) => (
              <article key={title} className="min-h-[230px] rounded-kv-main border border-kv-line bg-white p-6.5 shadow-sm">
                <span className="mb-4 block text-sm font-black text-kv-red">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mb-3 text-xl font-bold leading-tight text-kv-navy">{title}</h3>
                <p className="text-[15px] leading-relaxed text-kv-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-kv-bg-warm py-20" id="owners" aria-labelledby="owners-title">
        <div className="mx-auto grid max-w-kv-container gap-5 px-5 lg:grid-cols-2">
          <div className="rounded-kv-main border border-kv-line bg-white p-7 shadow-sm">
            <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">Покупателям и инвесторам</span>
            <h3 id="owners-title" className="mb-4 text-2xl font-black leading-tight text-kv-navy md:text-3xl">Подбор без лишних просмотров</h3>
            <p className="mb-5 leading-relaxed text-kv-muted">
              Перед показами фиксируем требования и отсеиваем объекты, которые не подходят по назначению, площади, локации или юридическим ограничениям.
            </p>
            <ul className="space-y-3 text-sm font-semibold text-kv-ink">
              <li>Объекты под офис, склад, гостиницу, участок, mixed-use или инвестиционный проект.</li>
              <li>Сравнение вариантов по локации, площади, ликвидности и правовому контуру.</li>
              <li>Подготовка вопросов для правообладателя информации и стороны продавца.</li>
            </ul>
          </div>

          <div className="rounded-kv-main border border-kv-line bg-white p-7 shadow-sm">
            <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">Собственникам</span>
            <h3 className="mb-4 text-2xl font-black leading-tight text-kv-navy md:text-3xl">Экспозиция объекта и квалификация спроса</h3>
            <p className="mb-5 leading-relaxed text-kv-muted">
              Готовим карточку объекта, управляем уровнем публичности, собираем обращения и ведем коммуникацию до сделки.
            </p>
            <ul className="space-y-3 text-sm font-semibold text-kv-ink">
              <li>Упаковка: фото, описание, характеристики, презентация, документы и условия.</li>
              <li>Публикация в общей витрине с учетом разрешений правообладателя информации.</li>
              <li>Организация показов, переговоров и безопасного обмена документами.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-white py-20" id="process" aria-labelledby="process-title">
        <div className="mx-auto max-w-kv-container px-5">
          <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">Процесс</span>
              <h2 id="process-title" className="text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">Как проходит работа</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-kv-muted">Структура помогает клиенту понять порядок действий до заявки, проверки объекта и сделки.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {process.map(([label, title, text]) => (
              <article key={label} className="rounded-kv-main border border-kv-line bg-kv-bg p-6">
                <span className="text-sm font-black uppercase tracking-widest text-kv-red">{label}</span>
                <h3 className="mt-3 text-xl font-bold text-kv-navy">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-kv-muted">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-kv-navy py-16 text-white" aria-labelledby="cta-title">
        <div className="mx-auto grid max-w-kv-container gap-7 px-5 lg:grid-cols-[1.2fr,0.8fr] lg:items-center">
          <div>
            <h2 id="cta-title" className="text-3xl font-black leading-tight md:text-5xl">Нужен объект под конкретную задачу?</h2>
            <p className="mt-4 max-w-2xl text-white/72">
              Опишите формат бизнеса, бюджет, страну, город и площадь. Мы подготовим подборку по открытым и закрытым предложениям.
            </p>
          </div>
          <form className="rounded-kv-main border border-white/16 bg-white/10 p-5 backdrop-blur-xl">
            <input type="tel" placeholder="Телефон" className="mb-3 h-11 w-full rounded-kv-form bg-white px-3.5 text-sm text-kv-ink outline-none" />
            <textarea placeholder="Что ищете: тип объекта, город, площадь, бюджет" className="mb-3 min-h-[92px] w-full rounded-kv-form bg-white px-3.5 py-3 text-sm text-kv-ink outline-none" />
            <button type="submit" className="w-full rounded-full bg-kv-red px-5 py-3 font-extrabold text-white hover:bg-kv-red-dark">Получить подборку</button>
          </form>
        </div>
      </section>

      <section className="bg-white py-20" id="contacts" aria-labelledby="contacts-title">
        <div className="mx-auto max-w-kv-container px-5">
          <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-2.5 block text-[13px] font-black uppercase tracking-widest text-kv-red">Контакты</span>
              <h2 id="contacts-title" className="text-3xl font-black leading-[1.08] tracking-tight text-kv-navy md:text-5xl">Связаться с KVARTAL</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-kv-muted">Для заявок по объектам, подбору, партнерским показам и сопровождению сделки.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr,1.1fr]">
            <div className="rounded-kv-main border border-kv-line bg-kv-bg p-6">
              <ul className="space-y-4 text-sm">
                <li><span className="block text-kv-muted">Телефон</span><a href="tel:+79772919573" className="font-bold text-kv-navy">+7 (977) 291-95-73</a></li>
                <li><span className="block text-kv-muted">Email</span><a href="mailto:info@kvartal-pro.ru" className="font-bold text-kv-navy">info@kvartal-pro.ru</a></li>
                <li><span className="block text-kv-muted">Офис</span><strong className="text-kv-navy">107113, Москва, Сокольническая площадь, д. 4А, пом. 34/3</strong></li>
                <li><span className="block text-kv-muted">Мессенджеры</span><strong className="text-kv-navy">Telegram / WhatsApp</strong></li>
              </ul>
            </div>
            <div className="rounded-kv-main border border-kv-line bg-[linear-gradient(135deg,#071d3a,#173c6b)] p-7 text-white">
              <h3 className="text-2xl font-black">Карта объектов и партнерских рынков</h3>
              <p className="mt-3 max-w-xl text-white/72">
                На рабочей версии здесь будет карта с объектами общей витрины: Москва, Московская область, Ростовская область, Сириус, Тбилиси, Дубай и Ереван.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
