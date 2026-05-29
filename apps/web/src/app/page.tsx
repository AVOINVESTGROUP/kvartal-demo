import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Objects } from "@/components/Objects";
import { SiteSections } from "@/components/SiteSections";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-kv-bg">
      <div className="bg-kv-navy py-2 text-[13px] text-white/80">
        <div className="mx-auto flex max-w-kv-container items-center justify-between gap-5 px-5">
          <div className="flex flex-wrap items-center gap-5">
            <span>ООО «КВАРТАЛ»</span>
            <span>107113, Москва, Сокольническая площадь, д. 4А, пом. 34/3</span>
          </div>
          <a href="tel:+79772919573" className="hidden font-bold text-white sm:block">
            +7 (977) 291-95-73
          </a>
        </div>
      </div>

      <Header />
      <Hero />
      <Features />
      <Objects />
      <SiteSections />
      <Footer />
    </main>
  );
}
