export const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-kv-navy/10 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-[64px] max-w-kv-container items-center justify-between gap-4 px-5 md:min-h-[78px]">
        <a href="#" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border-[3px] border-kv-navy bg-white text-2xl font-extrabold leading-none text-kv-red md:h-12 md:w-12 md:text-3xl">
            K
          </div>
          <div className="min-w-0">
            <span className="block text-xl font-extrabold uppercase leading-none tracking-[0.12em] text-kv-navy md:text-2xl md:tracking-[0.14em]">
              Kvartal
            </span>
            <span className="mt-1.5 block whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.2em] text-kv-muted md:text-[10px] md:tracking-[0.28em]">
              Центр недвижимости
            </span>
          </div>
        </a>

        <nav className="hidden items-center gap-6 text-[13px] font-extrabold uppercase tracking-wider text-kv-navy lg:flex">
          <a href="#about" className="transition-colors hover:text-kv-red">
            О компании
          </a>
          <a href="#objects" className="transition-colors hover:text-kv-red">
            Объекты
          </a>
          <a href="#services" className="transition-colors hover:text-kv-red">
            Услуги
          </a>
          <a href="#contacts" className="transition-colors hover:text-kv-red">
            Контакты
          </a>
        </nav>

        <div className="hidden min-w-max items-center gap-3 lg:flex">
          <a href="tel:+79772919573" className="hidden font-extrabold text-kv-navy sm:block">
            +7 (977) 291-95-73
          </a>
          <a
            href="#request"
            className="cursor-pointer rounded-full bg-kv-red px-5 py-3 text-[13px] font-extrabold text-white shadow-lg transition-all hover:-translate-y-px hover:bg-kv-red-dark"
          >
            Оставить заявку
          </a>
        </div>
      </div>
    </header>
  );
};
