import Image from "next/image";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-kv-navy/10 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-[64px] max-w-kv-container items-center justify-between gap-4 px-5 md:min-h-[78px]">
        <a href="#" className="relative block h-[48px] w-[190px] shrink-0 md:h-[58px] md:w-[240px]" aria-label="KVARTAL">
          <Image src="/images/kvartal-logo.png" alt="KVARTAL центр недвижимости" fill priority sizes="240px" className="object-contain" />
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
