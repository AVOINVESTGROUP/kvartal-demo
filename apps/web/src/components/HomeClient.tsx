"use client";

import { useState } from "react";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { ObjectsClient, type MarketSnapshot, type ObjectItem } from "@/components/ObjectsClient";
import { SiteSections } from "@/components/SiteSections";
import type { SiteLanguage } from "./site-language";

type HomeClientProps = {
  objects: ObjectItem[];
  marketSnapshot: MarketSnapshot | null;
  apiBaseUrl: string;
};

export function HomeClient({ objects, marketSnapshot, apiBaseUrl }: HomeClientProps) {
  const [language, setLanguage] = useState<SiteLanguage>("ru");

  return (
    <main className="min-h-screen overflow-x-hidden bg-kv-bg">
      <div className="bg-kv-navy py-2 text-[13px] text-white/80">
        <div className="mx-auto flex max-w-kv-container items-center justify-between gap-5 px-5">
          <div className="flex flex-wrap items-center gap-5">
            <span>ООО «КВАРТАЛ»</span>
            <span>
              {language === "ru"
                ? "107113, Москва, Сокольническая площадь, д. 4А, пом. 34/3"
                : "107113, Moscow, Sokolnicheskaya Square, 4A, room 34/3"}
            </span>
          </div>
          <a href="tel:+79772919573" className="hidden font-bold text-white sm:block">
            +7 (977) 291-95-73
          </a>
        </div>
      </div>

      <Header language={language} onLanguageChange={setLanguage} />
      <Hero language={language} />
      <Features language={language} />
      <ObjectsClient objects={objects} language={language} marketSnapshot={marketSnapshot} apiBaseUrl={apiBaseUrl} />
      <SiteSections language={language} />
      <Footer language={language} />
    </main>
  );
}
