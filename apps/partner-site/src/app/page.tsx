const inventory = [
  { market: "Moscow", title: "Commercial property", partner: "KVARTAL Moscow" },
  { market: "Dubai", title: "Investment project", partner: "Dubai Partner" },
  { market: "Tbilisi", title: "Premium apartment", partner: "Apart4u.co" },
];

export default function Apart4uSiteHome() {
  return (
    <main className="min-h-screen bg-apart-dark text-apart-light">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[url('/apart4u/Apart4Upic.jpeg')] bg-cover bg-center opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(7,11,19,0.98)_0%,rgba(7,11,19,0.95)_55%,rgba(7,11,19,0.18)_55.2%)]" />
        <div className="relative z-10 grid min-h-screen gap-8 px-8 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-between">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-[0.22em] text-apart-gold">
                Apartments · Investments · Real Solutions
              </div>
              <div className="mt-4 h-[2px] w-10 bg-apart-gold" />
            </div>

            <div className="max-w-[620px] text-center lg:ml-14">
              <div className="mx-auto mb-3 h-24 w-24 border-4 border-apart-gold" />
              <h1 className="text-[54px] font-semibold tracking-wide md:text-[72px]">
                Apart4<span className="text-apart-gold">U</span>
              </h1>
              <div className="mt-2 text-[14px] uppercase tracking-[0.28em] text-apart-gold">Real Estate Agency</div>
              <div className="mt-7 text-[16px] uppercase tracking-[0.45em]">Tbilisi</div>
            </div>

            <div className="grid max-w-[760px] gap-4 text-center sm:grid-cols-3">
              {["Premium properties", "Buyer-side representation", "Shared public inventory"].map((item) => (
                <div key={item} className="border-t border-apart-gold/40 pt-4 text-[12px] font-bold uppercase tracking-[0.16em]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <aside className="flex items-end justify-end">
            <div className="max-w-[430px]">
              <div className="text-[13px] uppercase tracking-[0.24em] leading-7">
                Your trusted partner in Tbilisi real estate and access point to the Fixer.guru partner network.
              </div>
              <div className="mt-4 h-[2px] w-10 bg-apart-gold" />
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-apart-dark px-6 py-12">
        <div className="mx-auto max-w-[1180px]">
          <div className="text-[12px] font-bold uppercase tracking-[0.22em] text-apart-gold">Shared Public Inventory</div>
          <h2 className="mt-2 text-[30px] font-semibold">Objects from the partner network</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {inventory.map((item) => (
              <div key={`${item.market}-${item.title}`} className="border border-apart-gold/35 bg-black/20 p-4">
                <div className="text-[12px] uppercase tracking-[0.18em] text-apart-gold">{item.market}</div>
                <div className="mt-3 text-[20px] font-semibold">{item.title}</div>
                <div className="mt-2 text-[13px] text-apart-gray">Seller-side: {item.partner}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
