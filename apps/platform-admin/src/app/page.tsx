import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "../lib/auth";
import { fetchBackendJson, writeBackendJson } from "../lib/server-api";

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

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

async function grantPlatformAccessAction(formData: FormData) {
  "use server";

  await requirePlatformOwner();
  await writeBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/access/platform-member", "POST", {
    email: formValue(formData, "email"),
    displayName: formValue(formData, "displayName"),
    role: formValue(formData, "role"),
  });
  revalidatePath("/");
}

async function grantOrganizationOwnerAction(formData: FormData) {
  "use server";

  await requirePlatformOwner();
  await writeBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/access/organization-owner", "POST", {
    organizationSlug: formValue(formData, "organizationSlug"),
    email: formValue(formData, "email"),
    displayName: formValue(formData, "displayName"),
  });
  revalidatePath("/");
}

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
  const { session, access } = await requirePlatformOwner();
  const [organizationsResponse, summaryResponse] = await Promise.all([
    fetchBackendJson<PlatformOrganizationsResponse>(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/organizations"),
    fetchBackendJson<PlatformSummaryResponse>(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/summary"),
  ]);

  const organizations = organizationsResponse?.organizations ?? fallbackOrganizations;
  const summary = summaryResponse?.summary;

  return (
    <main className="min-h-screen bg-kv-bg text-kv-ink">
      <section className="border-b border-kv-line bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 py-7 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">Fixer.guru owner console</div>
            <h1 className="mt-2 text-[34px] font-black leading-tight text-kv-navy">Partner Network Platform</h1>
            <p className="mt-2 max-w-[860px] text-[15px] leading-6 text-kv-muted">
              Управление партнерскими организациями, собственниками организаций, командой Fixer.guru и общей витриной.
            </p>
          </div>
          <div className="rounded-md border border-kv-line bg-kv-bg p-3 text-[13px]">
            <div className="font-black text-kv-navy">{session.name ?? session.email}</div>
            <div className="mt-1 text-kv-muted">{session.email}</div>
            <div className="mt-2 text-kv-muted">{access.platformRoles.join(", ")}</div>
            <a href="/logout" className="mt-3 inline-flex rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">Выйти</a>
          </div>
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

      <section className="mx-auto grid max-w-[1280px] gap-6 px-6 pb-6 xl:grid-cols-2">
        <form action={grantOrganizationOwnerAction} className="rounded-md border border-kv-line bg-white p-4">
          <h2 className="font-black text-kv-navy">Выдать доступ собственнику организации</h2>
          <p className="mt-2 text-[13px] leading-5 text-kv-muted">
            Fixer.guru назначает Gmail собственника организации. Дальше он управляет сотрудниками внутри своей организации.
          </p>
          <div className="mt-4 grid gap-3">
            <label className="text-[13px] font-bold text-kv-muted">
              Организация
              <select name="organizationSlug" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                {organizations.map((organization) => (
                  <option key={organization.slug} value={organization.slug}>{organization.legalName}</option>
                ))}
              </select>
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Gmail собственника
              <input name="email" required type="email" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Имя
              <input name="displayName" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <button className="rounded-full bg-kv-red px-5 py-3 text-sm font-black text-white">Назначить собственника</button>
          </div>
        </form>

        <form action={grantPlatformAccessAction} className="rounded-md border border-kv-line bg-white p-4">
          <h2 className="font-black text-kv-navy">Добавить члена команды Fixer.guru</h2>
          <p className="mt-2 text-[13px] leading-5 text-kv-muted">
            Эти Gmail получают доступ к админке собственника проекта по платформенным ролям.
          </p>
          <div className="mt-4 grid gap-3">
            <label className="text-[13px] font-bold text-kv-muted">
              Gmail
              <input name="email" required type="email" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Имя
              <input name="displayName" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
            </label>
            <label className="text-[13px] font-bold text-kv-muted">
              Роль
              <select name="role" defaultValue="platform_admin" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                <option value="platform_owner">Собственник проекта</option>
                <option value="platform_admin">Администратор платформы</option>
                <option value="platform_analyst">Аналитик</option>
                <option value="platform_viewer">Просмотр</option>
              </select>
            </label>
            <button className="rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Добавить в Fixer.guru</button>
          </div>
        </form>
      </section>
    </main>
  );
}
