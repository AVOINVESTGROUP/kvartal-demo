const partners = [
  { name: "KVARTAL Moscow", country: "RU", site: "kvartal-pro.ru", inventory: "seller-side" },
  { name: "Apart4u.co Tbilisi", country: "GE", site: "apart4u.co", inventory: "buyer-side + site" },
  { name: "Yerevan Partner", country: "AM", site: "planned", inventory: "planned" },
  { name: "Dubai Partner", country: "AE", site: "planned", inventory: "planned" },
];

export default function PlatformAdminHome() {
  return (
    <main className="min-h-screen bg-kv-bg text-kv-ink">
      <section className="border-b border-kv-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-7">
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">Fixer.guru owner console</div>
          <h1 className="mt-2 text-[34px] font-black leading-tight text-kv-navy">Платформа партнерской сети</h1>
          <p className="mt-2 max-w-[860px] text-[15px] leading-6 text-kv-muted">
            Управление партнерами, сайтами, общим опубликованным пулом объектов, доступами, аудитом и монетизацией.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-6 px-6 py-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-md border border-kv-line bg-white">
          <div className="border-b border-kv-line px-4 py-3">
            <h2 className="font-black text-kv-navy">Partner organizations</h2>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="text-[12px] uppercase tracking-[0.12em] text-kv-muted">
                <tr className="border-b border-kv-line">
                  <th className="py-3 pr-4">Партнер</th>
                  <th className="py-3 pr-4">Страна</th>
                  <th className="py-3 pr-4">Сайт</th>
                  <th className="py-3">Роль сети</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.name} className="border-b border-kv-line last:border-0">
                    <td className="py-3 pr-4 font-black text-kv-navy">{partner.name}</td>
                    <td className="py-3 pr-4 text-kv-muted">{partner.country}</td>
                    <td className="py-3 pr-4">{partner.site}</td>
                    <td className="py-3">{partner.inventory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-kv-line bg-white p-4">
          <h2 className="font-black text-kv-navy">Shared Public Inventory</h2>
          <p className="mt-2 text-[14px] leading-6 text-kv-muted">
            Общий опубликованный пул объектов отображается на сайтах партнеров в их собственном дизайне. Private data,
            legal docs, PII и комиссии не попадают в публичный слой.
          </p>
          <div className="mt-4 rounded-md bg-kv-bg p-3 text-[13px] font-bold text-kv-navy">
            visibility=public + publicationStatus=published + sharedToPartnerNetwork=true
          </div>
        </div>
      </section>
    </main>
  );
}
