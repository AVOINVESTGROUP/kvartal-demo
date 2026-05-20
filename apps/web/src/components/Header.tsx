export const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 border-b border-kv-navy/10 backdrop-blur-md">
      <div className="max-w-kv-container mx-auto px-5 min-h-[78px] flex items-center justify-between gap-6">
        <div className="flex items-center gap-3.5 min-w-max">
          <div className="w-12 h-12 border-3 border-kv-navy flex items-center justify-center text-kv-red font-extrabold text-3xl leading-none bg-white">
            K
          </div>
          <div>
            <span className="block text-kv-navy text-2xl font-extrabold tracking-[0.14em] leading-none uppercase">Kvartal</span>
            <span className="block mt-1.5 text-kv-muted text-[10px] font-bold tracking-[0.28em] uppercase whitespace-nowrap">Commercial Real Estate</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-kv-navy text-[13px] font-extrabold tracking-wider uppercase">
          <a href="#about" className="hover:text-kv-red transition-colors">О компании</a>
          <a href="#objects" className="hover:text-kv-red transition-colors">Объекты</a>
          <a href="#services" className="hover:text-kv-red transition-colors">Услуги</a>
          <a href="#contacts" className="hover:text-kv-red transition-colors">Контакты</a>
        </nav>

        <div className="flex items-center gap-3 min-w-max">
          <a href="tel:+74951234567" className="text-kv-navy font-extrabold hidden sm:block">+7 (495) 123-45-67</a>
          <button className="bg-kv-red text-white px-5 py-3 rounded-full font-extrabold text-[13px] hover:bg-kv-red-dark transition-all hover:-translate-y-px shadow-lg cursor-pointer">
            Оставить заявку
          </button>
        </div>
      </div>
    </header>
  );
};
