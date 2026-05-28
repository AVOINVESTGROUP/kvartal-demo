const objects = [
  { title: "Moscow investment object", owner: "KVARTAL Moscow", site: "visible on Apart4u.co", state: "shared public" },
  { title: "Tbilisi apartment", owner: "Apart4u.co", site: "apart4u.co", state: "own draft" },
  { title: "Dubai development project", owner: "Dubai Partner", site: "planned", state: "network candidate" },
];

export default function PartnerAdminHome() {
  return (
    <main className="min-h-screen bg-kv-bg text-kv-ink">
      <section className="border-b border-kv-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-7">
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">Partner organization console</div>
          <h1 className="mt-2 text-[34px] font-black text-kv-navy">Apart4u.co Tbilisi</h1>
          <p className="mt-2 max-w-[820px] text-[15px] leading-6 text-kv-muted">
            Управление объектами, лидами, публикацией на своем сайте и сделками, где партнер представляет сторону покупателя.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-6 px-6 py-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-md border border-kv-line bg-white">
          <div className="border-b border-kv-line px-4 py-3">
            <h2 className="font-black text-kv-navy">Inventory context</h2>
          </div>
          <div className="grid gap-3 p-4">
            {objects.map((object) => (
              <div key={object.title} className="grid gap-3 rounded-md border border-kv-line p-3 md:grid-cols-[1fr_170px_150px] md:items-center">
                <div>
                  <div className="font-black text-kv-navy">{object.title}</div>
                  <div className="mt-1 text-[13px] text-kv-muted">{object.owner}</div>
                </div>
                <div className="text-[13px] font-bold text-kv-muted">{object.site}</div>
                <div className="rounded-md bg-kv-bg px-2 py-2 text-center text-[12px] font-black text-kv-navy">{object.state}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-kv-line bg-white p-4">
          <h2 className="font-black text-kv-navy">Lead attribution</h2>
          <p className="mt-2 text-[14px] leading-6 text-kv-muted">
            Если клиент на apart4u.co выбирает объект Москвы, лид принадлежит Apart4u.co как buyer-side organization.
            KVARTAL Moscow остается seller-side organization по объекту.
          </p>
        </div>
      </section>
    </main>
  );
}
