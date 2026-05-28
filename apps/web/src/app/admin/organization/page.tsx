import { AdminLayout, Metric, Panel } from "@/components/admin/AdminLayout";

const objects = [
  { title: "Земельный участок, Домодедово", class: "land", status: "draft", visibility: "private", owner: "KVARTAL Moscow" },
  { title: "Квартира, Москва", class: "apartment", status: "published", visibility: "public", owner: "KVARTAL Moscow" },
  { title: "Дом, Подмосковье", class: "house", status: "published", visibility: "public", owner: "KVARTAL Moscow" },
];

const workflow = [
  { name: "Черновик объекта", count: "1", state: "private" },
  { name: "Проверка данных", count: "0", state: "office" },
  { name: "Юридические документы", count: "0", state: "restricted" },
  { name: "Публикация витрины", count: "2", state: "public" },
];

export default function OrganizationAdminPage() {
  return (
    <AdminLayout
      active="organization"
      eyebrow="Organization office console"
      title="Контур организации"
      subtitle="Рабочее место правообладателя информации: объекты, публикация, документы и внутренняя проверка."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Моя организация" value="KVARTAL" />
        <Metric label="Мои объекты" value="3" />
        <Metric label="Черновики" value="1" tone="red" />
        <Metric label="На витрине" value="2" tone="gold" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Panel title="Объекты организации">
          <div className="grid gap-3">
            {objects.map((item) => (
              <div key={item.title} className="grid gap-3 rounded-md border border-kv-line p-3 md:grid-cols-[1fr_120px_120px_150px] md:items-center">
                <div>
                  <div className="font-black text-kv-navy">{item.title}</div>
                  <div className="mt-1 text-[13px] text-kv-muted">{item.owner}</div>
                </div>
                <div className="text-[13px] font-bold text-kv-muted">{item.class}</div>
                <div className="text-[13px] font-bold text-kv-muted">{item.status}</div>
                <div className={`rounded-md px-2 py-2 text-center text-[12px] font-black ${item.visibility === "public" ? "bg-[#eaf5ef] text-[#176b3a]" : "bg-[#f8e8e8] text-kv-red"}`}>
                  {item.visibility}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Пользовательский поток">
          <div className="grid gap-3">
            {workflow.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 rounded-md border border-kv-line p-3">
                <div>
                  <div className="font-black text-kv-navy">{item.name}</div>
                  <div className="mt-1 text-[13px] text-kv-muted">{item.state}</div>
                </div>
                <div className="text-[24px] font-black text-kv-navy">{item.count}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AdminLayout>
  );
}
