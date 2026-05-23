import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Objects } from "@/components/Objects";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-kv-bg">
      {/* Topline */}
      <div className="bg-kv-navy text-white/80 text-[13px] py-2">
        <div className="max-w-kv-container mx-auto px-5 flex justify-between items-center gap-5">
          <div className="flex gap-5 items-center flex-wrap">
            <span>ЦАО: особняки, офисные здания</span>
            <span>г. Москва, ул. Большая Полянка, 2/10</span>
          </div>
          <div className="hidden sm:block">Ежедневно с 9:00 до 21:00</div>
        </div>
      </div>

      <Header />
      <Hero />
      <Features />
      <Objects />
      <Footer />
    </main>
  );
}
