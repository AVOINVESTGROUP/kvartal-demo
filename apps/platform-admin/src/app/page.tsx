import { fetchBackendJson } from "../lib/server-api";

export const dynamic = "force-dynamic";

type PlatformOrganizationsResponse = {
  organizations: Array<{
    slug: string;
    legalName: string;
    countryOfRegistration: string;
    status: string;
    counts: {
      offices: number;
      propertyObjects: number;
      clientIntents: number;
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
  }>;
};

type PlatformSummaryResponse = {
  summary: {
    organizationCount: number;
    officeCount: number;
    totalObjectCount: number;
    sharedPublicInventoryCount: number;
    database: string;
  };
};

const fallbackOrganizations: PlatformOrganizationsResponse["organizations"] = [
  {
    slug: "apart4u-tbilisi",
    legalName: "Apart4u.co Tbilisi",
    countryOfRegistration: "GE",
    status: "fallback",
    counts: { offices: 1, propertyObjects: 0, clientIntents: 0 },
    offices: [],
  },
];

export default async function PlatformAdminHome() {
  const [organizationsResponse, summaryResponse] = await Promise.all([
    fetchBackendJson<PlatformOrganizationsResponse>(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/organizations"),
    fetchBackendJson<PlatformSummaryResponse>(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/summary"),
  ]);

  const organizations = organizationsResponse?.organizations ?? fallbackOrganizations;
  const summary = summaryResponse?.summary;

  return (
    <main className="min-h-screen bg-kv-bg text-kv-ink">
      <section className="border-b border-kv-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-7">
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">Fixer.guru owner console</div>
          <h1 className="mt-2 text-[34px] font-black leading-tight text-kv-navy">Partner Network Platform</h1>
          <p className="mt-2 max-w-[860px] text-[15px] leading-6 text-kv-muted">
            Owner-level view of partner organizations, offices, publication rights, and the shared public inventory. Data is loaded from
            Cloud SQL through the protected platform API.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-6 px-6 py-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-md border border-kv-line bg-white">
          <div className="border-b border-kv-line px-4 py-3">
            <h2 className="font-black text-kv-navy">Partner organizations</h2>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead className="text-[12px] uppercase tracking-[0.12em] text-kv-muted">
                <tr className="border-b border-kv-line">
                  <th className="py-3 pr-4">Partner</th>
                  <th className="py-3 pr-4">Country</th>
                  <th className="py-3 pr-4">Offices</th>
                  <th className="py-3 pr-4">Objects</th>
                  <th className="py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.slug} className="border-b border-kv-line last:border-0">
                    <td className="py-3 pr-4 font-black text-kv-navy">{organization.legalName}</td>
                    <td className="py-3 pr-4 text-kv-muted">{organization.countryOfRegistration}</td>
                    <td className="py-3 pr-4">{organization.counts.offices}</td>
                    <td className="py-3 pr-4">{organization.counts.propertyObjects}</td>
                    <td className="py-3">{organization.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-kv-line bg-white p-4">
          <h2 className="font-black text-kv-navy">Database connection</h2>
          <div className="mt-4 grid gap-3 text-[14px]">
            <div className="rounded-md bg-kv-bg p-3">
              <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">Organizations</div>
              <div className="mt-1 text-[26px] font-black text-kv-navy">{summary?.organizationCount ?? organizations.length}</div>
            </div>
            <div className="rounded-md bg-kv-bg p-3">
              <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">Offices</div>
              <div className="mt-1 text-[26px] font-black text-kv-navy">{summary?.officeCount ?? "live"}</div>
            </div>
            <div className="rounded-md bg-kv-bg p-3">
              <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">Shared Public Inventory</div>
              <div className="mt-1 text-[26px] font-black text-kv-navy">{summary?.sharedPublicInventoryCount ?? "live"}</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
