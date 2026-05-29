import Image from "next/image";
import type { SiteLanguage } from "./site-language";

export const Footer = ({ language }: { language: SiteLanguage }) => {
  return (
    <footer className="bg-kv-navy py-8 text-white/72">
      <div className="mx-auto max-w-kv-container px-5">
        <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
          <div className="rounded bg-white p-2">
            <Image src="/images/kvartal-logo.png" alt="KVARTAL центр недвижимости" width={240} height={72} className="h-auto w-[210px] md:w-[240px]" />
          </div>

          <div className="max-w-xl text-sm leading-relaxed md:text-right">
            <p className="font-bold text-white">ООО «КВАРТАЛ»</p>
            <p>{language === "ru" ? "107113, Москва, Сокольническая площадь, д. 4А, пом. 34/3" : "107113, Moscow, Sokolnicheskaya Square, 4A, room 34/3"}</p>
            <p>
              {language === "ru" ? "Тел." : "Phone"}:{" "}
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
            <p className="mt-3 text-white/62">Development and design by AVOINVESTGROUP</p>
            <p className="mt-3 text-white/62">© 2026 KVARTAL. {language === "ru" ? "Все права защищены." : "All rights reserved."}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};
