import Link from "next/link";

type AdminLayoutProps = {
  active: "platform" | "organization";
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AdminLayout({ active, eyebrow, title, subtitle, children }: AdminLayoutProps) {
  return (
    <main className="min-h-screen bg-[#eef2f6] text-kv-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-[264px] border-r border-kv-line bg-white px-4 py-5 lg:block">
        <Link href="/" className="block text-[20px] font-black tracking-[0.16em] text-kv-navy">
          KVARTAL
        </Link>
        <nav className="mt-8 grid gap-2 text-[14px] font-bold">
          <Link
            href="/admin/platform"
            className={`rounded-md px-3 py-3 ${active === "platform" ? "bg-kv-navy text-white" : "text-kv-navy hover:bg-kv-bg"}`}
          >
            Собственник проекта
          </Link>
          <Link
            href="/admin/organization"
            className={`rounded-md px-3 py-3 ${active === "organization" ? "bg-kv-navy text-white" : "text-kv-navy hover:bg-kv-bg"}`}
          >
            Организация
          </Link>
        </nav>
        <div className="absolute bottom-5 left-4 right-4 border-t border-kv-line pt-4 text-[12px] leading-5 text-kv-muted">
          Доступ разделен по субъектам права. Витрина публикуется отдельно.
        </div>
      </aside>

      <section className="lg:pl-[264px]">
        <header className="border-b border-kv-line bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">{eyebrow}</div>
                <h1 className="mt-2 text-[28px] font-black leading-tight text-kv-navy md:text-[34px]">{title}</h1>
                <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-kv-muted">{subtitle}</p>
              </div>
              <div className="flex gap-2 lg:hidden">
                <Link href="/admin/platform" className="rounded-md border border-kv-line bg-white px-3 py-2 text-[13px] font-bold text-kv-navy">
                  Проект
                </Link>
                <Link href="/admin/organization" className="rounded-md border border-kv-line bg-white px-3 py-2 text-[13px] font-bold text-kv-navy">
                  Организация
                </Link>
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </section>
    </main>
  );
}

export function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "red" | "gold" }) {
  const toneClass = tone === "red" ? "text-kv-red" : tone === "gold" ? "text-kv-gold" : "text-kv-navy";

  return (
    <div className="rounded-md border border-kv-line bg-white p-4">
      <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-kv-muted">{label}</div>
      <div className={`mt-2 text-[28px] font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-kv-line bg-white">
      <div className="border-b border-kv-line px-4 py-3">
        <h2 className="text-[15px] font-black text-kv-navy">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
