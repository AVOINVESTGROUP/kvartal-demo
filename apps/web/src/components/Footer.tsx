export const Footer = () => {
  return (
    <footer id="contacts" className="bg-kv-navy py-8 text-white/72">
      <div className="mx-auto max-w-kv-container px-5">
        <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-max items-center gap-3.5 text-white">
            <div className="flex h-12 w-12 items-center justify-center border-[3px] border-white/70 text-3xl font-extrabold leading-none text-kv-red">
              K
            </div>
            <div>
              <span className="block text-2xl font-extrabold uppercase leading-none tracking-[0.14em]">Kvartal</span>
              <span className="mt-1.5 block whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.28em]">
                Центр недвижимости
              </span>
            </div>
          </div>

          <div className="max-w-xl text-sm leading-relaxed md:text-right">
            <p className="font-bold text-white">ООО «КВАРТАЛ»</p>
            <p>107113, г. Москва, Сокольническая площадь, д. 4А, пом. 34/3</p>
            <p>
              Тел.:{" "}
              <a href="tel:+79772919573" className="border-b border-white/22 text-white transition-colors hover:text-white/80">
                +7 (977) 291-95-73
              </a>
            </p>
            <p>
              e-mail:{" "}
              <a href="mailto:info@kvartal-pro.ru" className="border-b border-white/22 text-white transition-colors hover:text-white/80">
                info@kvartal-pro.ru
              </a>
            </p>
            <p className="mt-3 text-white/62">
              ИНН 9718286440 | КПП 771801001 | ОГРН 1257700412694 | Р/С 40702810802730006807 | АО «АЛЬФА-БАНК» | БИК 044525593
            </p>
            <p className="mt-3 text-white/62">© 2026 KVARTAL. Все права защищены.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
