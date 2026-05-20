export const Footer = () => {
  return (
    <footer className="bg-kv-navy text-white/72 py-8">
      <div className="max-w-kv-container mx-auto px-5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-7">
          <div className="flex items-center gap-3.5 min-w-max text-white">
            <div className="w-12 h-12 border-3 border-white/70 flex items-center justify-center text-kv-red font-extrabold text-3xl leading-none">
              K
            </div>
            <div>
              <span className="block text-2xl font-extrabold tracking-[0.14em] leading-none uppercase">Kvartal</span>
              <span className="block mt-1.5 text-[10px] font-bold tracking-[0.28em] uppercase whitespace-nowrap">Commercial Real Estate</span>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center md:justify-end gap-4.5 text-sm">
            <a href="#" className="border-b border-white/22 hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="#" className="border-b border-white/22 hover:text-white transition-colors">Пользовательское соглашение</a>
            <p className="w-full md:w-auto text-center md:text-right">© 2026 KVARTAL. Все права защищены.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
