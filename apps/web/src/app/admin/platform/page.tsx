import { AdminLayout, Metric, Panel } from "@/components/admin/AdminLayout";

const organizations = [
  { name: "Fixer.guru", country: "AE", offices: 1, privateObjects: 0, publicObjects: 0, status: "active" },
  { name: "KVARTAL Moscow", country: "RU", offices: 1, privateObjects: 3, publicObjects: 2, status: "active" },
  { name: "Apart4u.co Tbilisi", country: "GE", offices: 1, privateObjects: 0, publicObjects: 0, status: "active" },
];

const auditQueue = [
  { scope: "platform_owner", action: "Просмотр private объектов организации", subject: "KVARTAL Moscow", state: "audit required" },
  { scope: "policy", action: "Публикация на витрину", subject: "public + published", state: "allowed" },
  { scope: "policy", action: "Доступ другой организации к private", subject: "cross-organization", state: "denied" },
];

export default function PlatformAdminPage() {
  return (
    <AdminLayout
      active="platform"
      eyebrow="Platform owner console"
      title="Контур собственника проекта"
      subtitle="Глобальный контроль организаций, офисов, прав публикации и аудируемого доступа к данным."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Организации" value="3" />
        <Metric label="Офисы" value="3" />
        <Metric label="Private объекты" value="3" tone="red" />
        <Metric label="Public витрина" value="2" tone="gold" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Panel title="Субъекты права">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-kv-line text-[12px] uppercase tracking-[0.12em] text-kv-muted">
                  <th className="py-3 pr-4">Организация</th>
                  <th className="py-3 pr-4">Страна</th>
                  <th className="py-3 pr-4">Офисы</th>
                  <th className="py-3 pr-4">Private</th>
                  <th className="py-3 pr-4">Public</th>
                  <th className="py-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((item) => (
                  <tr key={item.name} className="border-b border-kv-line last:border-0">
                    <td className="py-3 pr-4 font-black text-kv-navy">{item.name}</td>
                    <td className="py-3 pr-4 text-kv-muted">{item.country}</td>
                    <td className="py-3 pr-4">{item.offices}</td>
                    <td className="py-3 pr-4">{item.privateObjects}</td>
                    <td className="py-3 pr-4">{item.publicObjects}</td>
                    <td className="py-3">
                      <span className="rounded-md bg-[#eaf5ef] px-2 py-1 text-[12px] font-bold text-[#176b3a]">{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Контроль доступа">
          <div className="grid gap-3">
            {auditQueue.map((item) => (
              <div key={`${item.scope}-${item.action}`} className="rounded-md border border-kv-line p-3">
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-kv-muted">{item.scope}</div>
                <div className="mt-1 font-black text-kv-navy">{item.action}</div>
                <div className="mt-1 text-[13px] text-kv-muted">{item.subject}</div>
                <div className="mt-3 inline-flex rounded-md bg-kv-bg px-2 py-1 text-[12px] font-bold text-kv-navy">{item.state}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AdminLayout>
  );
}
