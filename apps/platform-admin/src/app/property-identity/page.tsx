import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "../../lib/auth";
import { fetchSecureActorBackendJson, writeSecureActorBackendJson } from "../../lib/server-api";

export const dynamic = "force-dynamic";

type MonitoringResponse = {
  generatedAt: string;
  submissionsByStatus: Record<string, number>;
  profilesByStatus: Record<string, number>;
  checksLast24HoursByStatus: Record<string, number>;
  jobsByStatus: Record<string, number>;
  rolloutPolicies: Array<{ id: string; scope: string; organizationId: string | null; marketId: string | null; mode: string; registryEnabled: boolean; publishGateEnabled: boolean; activationAt: string | null; version: number }>;
  authorityPolicies: Array<{ id: string; jurisdiction: string; identifierScheme: string; authorityNamespacePattern: string; active: boolean; version: number }>;
  recentEvents: Array<{ id: string; submissionId: string | null; eventType: string; previousStatus: string | null; nextStatus: string | null; reasonCode: string | null; createdAt: string }>;
  pendingRights: Array<{ id: string; propertyObjectId: string; title: string; organization: string; office: string; rightType: string; status: string; createdAt: string }>;
  pendingGrants: Array<{ id: string; propertyObjectId: string; surface: string; representationStatus: string; offerStatus: string; status: string; createdAt: string }>;
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function verifyRepresentationRightAction(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  const id = formValue(formData, "id");
  const reason = formValue(formData, "reason");
  if (!id || reason.length < 10) return;
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/representation-rights/${encodeURIComponent(id)}/verify`, "POST", { reason }, { "Idempotency-Key": `right-verify:${crypto.randomUUID()}` });
  revalidatePath("/property-identity");
}

async function activatePublicationGrantAction(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  const id = formValue(formData, "id");
  const reason = formValue(formData, "reason");
  if (!id || reason.length < 10) return;
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/publication-grants/${encodeURIComponent(id)}/activate`, "POST", { reason }, { "Idempotency-Key": `grant-activate:${crypto.randomUUID()}` });
  revalidatePath("/property-identity");
}

function MetricList({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values);
  return <section className="rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">{title}</h2><div className="mt-3 grid gap-2">{entries.length ? entries.map(([name, count]) => <div key={name} className="flex justify-between rounded bg-kv-bg p-3 text-sm"><span>{name}</span><b>{count}</b></div>) : <p className="text-sm text-kv-muted">Нет данных</p>}</div></section>;
}

export default async function PropertyIdentityMonitoringPage() {
  await requirePlatformOwner();
  const data = await fetchSecureActorBackendJson<MonitoringResponse>(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/monitoring");

  return <main className="min-h-screen bg-kv-bg p-6 text-kv-ink"><div className="mx-auto max-w-[1280px]">
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div><div className="text-xs font-black uppercase tracking-[.18em] text-kv-red">Управление владельца платформы</div><h1 className="mt-2 text-3xl font-black text-kv-navy">Единый Property Identity Registry</h1><p className="mt-2 max-w-3xl text-sm text-kv-muted">Партнёры создают объекты в обычном кабинете. Здесь владелец платформы контролирует глобальный реестр, проверяет права представления, разрешает публикацию и наблюдает техническое состояние.</p></div>
      <Link href="/" className="self-start rounded-full border border-kv-line bg-white px-4 py-2 font-black">Назад</Link>
    </header>
    <p className="mt-4 text-xs text-kv-muted">Снимок: {new Date(data.generatedAt).toISOString()}</p>

    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricList title="Операции идентификации" values={data.submissionsByStatus}/><MetricList title="Identity-профили" values={data.profilesByStatus}/><MetricList title="Проверки за 24 часа" values={data.checksLast24HoursByStatus}/><MetricList title="Фоновые задания" values={data.jobsByStatus}/></div>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Права представления, ожидающие проверки</h2><p className="mt-1 text-sm text-kv-muted">Подтверждение относится к праву партнёра представлять объект, а не к созданию самого объекта.</p><div className="mt-3 grid gap-3">{data.pendingRights.map(item => <form action={verifyRepresentationRightAction} key={item.id} className="rounded border border-kv-line bg-kv-bg p-3"><input type="hidden" name="id" value={item.id}/><div className="font-black">{item.title}</div><div className="text-xs text-kv-muted">{item.organization} · {item.office} · {item.rightType} · {item.status}</div><div className="mt-3 flex flex-col gap-2 md:flex-row"><input name="reason" required minLength={10} placeholder="Основание проверки доказательств" className="min-h-11 flex-1 rounded border border-kv-line bg-white px-3"/><button className="rounded bg-kv-navy px-4 py-2 font-black text-white">Подтвердить право</button></div></form>)}{data.pendingRights.length ? null : <p className="text-sm text-kv-muted">Нет прав, ожидающих проверки.</p>}</div></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Разрешения на публикацию</h2><p className="mt-1 text-sm text-kv-muted">Разрешение действует для конкретной витрины и конкретного offer.</p><div className="mt-3 grid gap-3">{data.pendingGrants.map(item => <form action={activatePublicationGrantAction} key={item.id} className="rounded border border-kv-line bg-kv-bg p-3"><input type="hidden" name="id" value={item.id}/><div className="font-black">{item.surface}</div><div className="text-xs text-kv-muted">объект {item.propertyObjectId} · право {item.representationStatus} · offer {item.offerStatus}</div><div className="mt-3 flex flex-col gap-2 md:flex-row"><input name="reason" required minLength={10} placeholder="Основание публикации" className="min-h-11 flex-1 rounded border border-kv-line bg-white px-3"/><button disabled={item.representationStatus !== "VERIFIED" || item.offerStatus !== "ACTIVE"} className="rounded bg-kv-navy px-4 py-2 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Разрешить публикацию</button></div></form>)}{data.pendingGrants.length ? null : <p className="text-sm text-kv-muted">Нет разрешений, ожидающих активации.</p>}</div></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Правила включения</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Scope</th><th className="p-2">Режим</th><th className="p-2">Registry</th><th className="p-2">Publish gate</th><th className="p-2">Активация</th><th className="p-2">Версия</th></tr></thead><tbody>{data.rolloutPolicies.map(item => <tr key={item.id} className="border-b last:border-0"><td className="p-2">{item.scope}<div className="text-xs text-kv-muted">{item.organizationId ?? item.marketId ?? "global"}</div></td><td className="p-2 font-bold">{item.mode}</td><td className="p-2">{item.registryEnabled ? "ON" : "OFF"}</td><td className="p-2">{item.publishGateEnabled ? "ON" : "OFF"}</td><td className="p-2">{item.activationAt ? new Date(item.activationAt).toISOString() : "—"}</td><td className="p-2">v{item.version}</td></tr>)}</tbody></table></div></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Официальные идентификаторы</h2><div className="mt-3 grid gap-2">{data.authorityPolicies.map(item => <div key={item.id} className="rounded bg-kv-bg p-3 text-sm"><b>{item.jurisdiction} · {item.identifierScheme}</b><div className="text-xs text-kv-muted">{item.authorityNamespacePattern} · {item.active ? "active" : "inactive"} · v{item.version}</div></div>)}</div></section>
    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Последние события</h2><ol className="mt-3 grid gap-2 text-sm">{data.recentEvents.map(item => <li key={item.id} className="rounded bg-kv-bg p-3"><b>{item.eventType}</b> · {item.previousStatus ?? "—"} → {item.nextStatus ?? "—"}<div className="text-xs text-kv-muted">{new Date(item.createdAt).toISOString()} · операция {item.submissionId ?? "—"} · {item.reasonCode ?? "—"}</div></li>)}</ol></section>
  </div></main>;
}
