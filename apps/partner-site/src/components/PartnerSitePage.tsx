import type { PartnerTenantConfig } from "../tenants";
import { Apart4uSite } from "./Apart4uSite";

type PartnerSitePageProps = {
  tenant: PartnerTenantConfig;
  inventoryOverride?: PartnerTenantConfig["inventory"];
};

export function PartnerSitePage({ tenant, inventoryOverride }: PartnerSitePageProps) {
  const inventory = inventoryOverride ?? tenant.inventory;

  if (tenant.key === "apart4u") {
    return <Apart4uSite tenant={tenant} inventory={inventoryOverride ?? []} />;
  }

  return (
    <main className="min-h-screen bg-apart-dark text-apart-light">
      <section className="relative min-h-screen overflow-hidden">
        {tenant.heroImage ? (
          <div className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: `url('${tenant.heroImage}')` }} />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(212,175,55,0.24),transparent_34%),linear-gradient(135deg,rgba(20,26,38,1),rgba(4,7,12,1))]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(7,11,19,0.98)_0%,rgba(7,11,19,0.95)_55%,rgba(7,11,19,0.18)_55.2%)]" />
        <div className="relative z-10 grid min-h-screen gap-8 px-8 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-between">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-[0.22em] text-apart-gold">{tenant.accentLabel}</div>
              <div className="mt-4 h-[2px] w-10 bg-apart-gold" />
            </div>

            <div className="max-w-[620px] text-center lg:ml-14">
              <div className="mx-auto mb-3 h-24 w-24 border-4 border-apart-gold" />
              <h1 className="text-[48px] font-semibold tracking-wide md:text-[72px]">{tenant.name}</h1>
              <div className="mt-2 text-[14px] uppercase tracking-[0.28em] text-apart-gold">{tenant.legalLabel}</div>
              <div className="mt-7 text-[16px] uppercase tracking-[0.45em]">{tenant.city}</div>
            </div>

            <div className="grid max-w-[760px] gap-4 text-center sm:grid-cols-3">
              {tenant.strengths.map((item) => (
                <div key={item} className="border-t border-apart-gold/40 pt-4 text-[12px] font-bold uppercase tracking-[0.16em]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <aside className="flex items-end justify-end">
            <div className="max-w-[430px]">
              <div className="text-[13px] uppercase leading-7 tracking-[0.24em]">{tenant.tagline}</div>
              <div className="mt-4 h-[2px] w-10 bg-apart-gold" />
              <div className="mt-4 text-[12px] uppercase tracking-[0.18em] text-apart-gray">
                {tenant.domainLabel} / {tenant.country}
              </div>
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
              <div key={`${tenant.key}-${item.market}-${item.title}`} className="border border-apart-gold/35 bg-black/20 p-4">
                <div className="text-[12px] uppercase tracking-[0.18em] text-apart-gold">{item.market}</div>
                <div className="mt-3 text-[20px] font-semibold">{item.title}</div>
                <div className="mt-2 text-[13px] text-apart-gray">Seller-side: {item.sellerSidePartner}</div>
                <div className="mt-1 text-[13px] text-apart-gray">Buyer-side: {item.buyerSidePartner}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
