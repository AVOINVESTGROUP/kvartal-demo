import { fetchBackendJson } from "../lib/server-api";

export const dynamic = "force-dynamic";

type PartnerContextResponse = {
  organization: {
    slug: string;
    legalName: string;
    countryOfRegistration: string;
    operatingCountryCodes: string[];
    status: string;
    counts: {
      ownedObjects: number;
      informationOwnedObjects: number;
      clientIntents: number;
      sharedPublicInventory: number;
    };
    offices: Array<{
      slug: string;
      legalName: string;
      city: string;
      country: string;
      status: string;
      counts: {
        propertyObjects: number;
        clientIntents: number;
      };
    }>;
  };
};

export default async function KvartalAdminHome() {
  const organizationSlug = process.env.PARTNER_ORGANIZATION_SLUG ?? "kvartal-moscow";
  const context = await fetchBackendJson<PartnerContextResponse>(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/context?organizationSlug=${encodeURIComponent(organizationSlug)}`,
  );
  const organization = context?.organization;

  return (
    <main className="min-h-screen bg-kv-bg text-kv-ink">
      <section className="border-b border-kv-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-7">
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">KVARTAL Moscow admin</div>
          <h1 className="mt-2 text-[34px] font-black text-kv-navy">{organization?.legalName ?? "KVARTAL Moscow"}</h1>
          <p className="mt-2 max-w-[820px] text-[15px] leading-6 text-kv-muted">
            Organization-scoped console for KVARTAL Moscow. Data comes from PostgreSQL through the protected partner API.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-6 px-6 py-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-md border border-kv-line bg-white">
          <div className="border-b border-kv-line px-4 py-3">
            <h2 className="font-black text-kv-navy">Offices</h2>
          </div>
          <div className="grid gap-3 p-4">
            {(organization?.offices ?? []).map((office) => (
              <div key={office.slug} className="grid gap-3 rounded-md border border-kv-line p-3 md:grid-cols-[1fr_150px_150px] md:items-center">
                <div>
                  <div className="font-black text-kv-navy">{office.legalName}</div>
                  <div className="mt-1 text-[13px] text-kv-muted">
                    {office.city}, {office.country}
                  </div>
                </div>
                <div className="text-[13px] font-bold text-kv-muted">{office.counts.propertyObjects} objects</div>
                <div className="rounded-md bg-kv-bg px-2 py-2 text-center text-[12px] font-black text-kv-navy">{office.status}</div>
              </div>
            ))}
            {!organization?.offices.length ? <div className="text-[14px] text-kv-muted">No live organization context loaded.</div> : null}
          </div>
        </div>

        <div className="rounded-md border border-kv-line bg-white p-4">
          <h2 className="font-black text-kv-navy">Rights and inventory</h2>
          <div className="mt-4 grid gap-3 text-[14px]">
            <div className="rounded-md bg-kv-bg p-3">
              <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">Owned objects</div>
              <div className="mt-1 text-[26px] font-black text-kv-navy">{organization?.counts.ownedObjects ?? 0}</div>
            </div>
            <div className="rounded-md bg-kv-bg p-3">
              <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">Information-owned objects</div>
              <div className="mt-1 text-[26px] font-black text-kv-navy">{organization?.counts.informationOwnedObjects ?? 0}</div>
            </div>
            <div className="rounded-md bg-kv-bg p-3">
              <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">Shared public inventory</div>
              <div className="mt-1 text-[26px] font-black text-kv-navy">{organization?.counts.sharedPublicInventory ?? 0}</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
