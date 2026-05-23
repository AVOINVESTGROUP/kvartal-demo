export const Hero = () => {
  return (
    <section className="kv-hero relative isolate overflow-hidden text-white">
      <div className="kv-hero-grid absolute inset-0 pointer-events-none" />

      <div className="relative z-10 mx-auto w-full max-w-kv-container px-5 py-12 sm:py-14 lg:py-18 xl:py-20">
        <div className="min-w-0 max-w-[720px]">
          <div className="mb-4 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-widest text-white/80 before:h-[2px] before:w-[34px] before:bg-kv-gold before:content-[''] sm:text-[13px]">
            Elite Commercial Real Estate
          </div>

          <h1 className="max-w-[680px] text-[28px] font-black leading-[1.06] tracking-0 min-[420px]:text-[34px] sm:text-[54px] sm:leading-[0.98] lg:text-[64px] xl:text-[72px]">
            Продажа и аренда особняков в Москве
          </h1>

          <p className="mt-5 max-w-[620px] text-base leading-relaxed text-white/78 sm:text-xl">
            Подбор уникальных объектов недвижимости в ЦАО для вашего бизнеса.
            Офф-маркет предложения и полное сопровождение.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button className="min-h-[52px] rounded-full bg-kv-red px-6 py-3.5 font-extrabold text-white shadow-xl transition-all hover:-translate-y-px hover:bg-kv-red-dark cursor-pointer sm:px-8">
              Смотреть объекты
            </button>
            <button className="min-h-[52px] rounded-full border border-white/28 bg-white/10 px-6 py-3.5 font-extrabold text-white transition-all hover:bg-white/20 cursor-pointer sm:px-8">
              О компании
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-kv-form border border-white/12 bg-white/6 p-4">
              <span className="block text-3xl font-black text-white">15+</span>
              <span className="mt-1 block text-[13px] text-white/68">лет на рынке</span>
            </div>
            <div className="rounded-kv-form border border-white/12 bg-white/6 p-4">
              <span className="block text-3xl font-black text-white">250+</span>
              <span className="mt-1 block text-[13px] text-white/68">объектов в ЦАО</span>
            </div>
            <div className="rounded-kv-form border border-white/12 bg-white/6 p-4">
              <span className="block text-3xl font-black text-white">48</span>
              <span className="mt-1 block text-[13px] text-white/68">сделок в 2023</span>
            </div>
          </div>

          <div className="mt-7 rounded-kv-main border border-white/16 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
            <div className="mb-3">
              <h2 className="text-xl font-bold leading-tight">Подобрать объект</h2>
              <p className="mt-1 text-[13px] leading-snug text-white/68">
                Короткая заявка - подборка за 15 минут
              </p>
            </div>

            <form className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1fr,1fr] xl:grid-cols-[1fr,1fr,1.1fr,auto]">
              <input
                type="text"
                placeholder="Ваше имя"
                className="h-11 w-full rounded-kv-form bg-white px-3.5 text-sm text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18"
              />
              <input
                type="tel"
                placeholder="+7 (___) ___-__-__"
                className="h-11 w-full rounded-kv-form bg-white px-3.5 text-sm text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18"
              />
              <input
                type="text"
                placeholder="Задача и бюджет"
                className="h-11 w-full rounded-kv-form bg-white px-3.5 text-sm text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18 sm:col-span-2 xl:col-span-1"
              />
              <button
                type="submit"
                className="h-11 rounded-full bg-kv-red px-5 text-sm font-extrabold text-white shadow-lg transition-all hover:bg-kv-red-dark cursor-pointer sm:col-span-2 xl:col-span-1"
              >
                Отправить
              </button>
              <label className="flex gap-2 text-[11px] leading-snug text-white/62 sm:col-span-2 xl:col-span-4">
                <input type="checkbox" className="mt-0.5" defaultChecked />
                <span>Согласие с политикой обработки персональных данных</span>
              </label>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
