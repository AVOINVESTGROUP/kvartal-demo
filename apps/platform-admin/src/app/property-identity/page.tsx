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
  rolloutPolicies: Array<{ id: string; scope: string; organizationId: string | null; marketId: string | null; mode: string; registryEnabled: boolean; publishGateEnabled: boolean; version: number }>;
  authorityPolicies: Array<{ id: string; jurisdiction: string; identifierScheme: string; authorityNamespacePattern: string; active: boolean; version: number }>;
  recentEvents: Array<{ id: string; submissionId: string | null; eventType: string; previousStatus: string | null; nextStatus: string | null; reasonCode: string | null; createdAt: string }>;
  representationRights: Array<{ id: string; propertyObjectId: string; title: string; organization: string; office: string; rightType: string; status: string; corporateWallet: string | null; evidenceHash: string | null; auditReason: string | null; updatedAt: string }>;
  publicationGrants: Array<{ id: string; propertyObjectId: string; surface: string; representationStatus: string; offerStatus: string; status: string; createdAt: string }>;
};

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

async function auditRepresentationAction(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  const id = value(formData, "id");
  const action = value(formData, "action");
  const reason = value(formData, "reason");
  if (!id || !["DISPUTE", "SUSPEND", "REVOKE"].includes(action) || reason.length < 10) return;
  await writeSecureActorBackendJson(
    process.env.PLATFORM_API_BASE_URL,
    `/api/v1/platform/property-identity/representation-rights/${encodeURIComponent(id)}/audit`,
    "POST",
    { action, reason },
    { "Idempotency-Key": `right-audit:${crypto.randomUUID()}` },
  );
  revalidatePath("/property-identity");
}

async function updateRolloutPolicyAction(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  const id = value(formData, "id");
  const expectedVersion = Number(value(formData, "expectedVersion"));
  const mode = value(formData, "mode");
  const reason = value(formData, "reason");
  if (!id || !Number.isSafeInteger(expectedVersion) || reason.length < 10) return;
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/rollout-policies/${encodeURIComponent(id)}`, "PATCH", {
    expectedVersion,
    mode,
    registryEnabled: formData.get("registryEnabled") === "on",
    publishGateEnabled: formData.get("publishGateEnabled") === "on",
    reason,
  }, { "Idempotency-Key": `rollout:${crypto.randomUUID()}` });
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
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="text-xs font-black uppercase tracking-[.18em] text-kv-red">Владелец платформы</div><h1 className="mt-2 text-3xl font-black text-kv-navy">Единый Property Identity Registry</h1><p className="mt-2 max-w-3xl text-sm text-kv-muted">Агентства публикуют объекты в обычной форме и сами заявляют документально подтверждённое право представления. Платформа автоматически проверяет уникальность и целостность. Здесь нет очереди ручного одобрения — только мониторинг и аудит нарушений.</p></div><div className="flex gap-2"><Link href="/property-identity/web3" className="rounded-full bg-kv-navy px-4 py-2 font-black text-white">Web3</Link><Link href="/" className="rounded-full border border-kv-line bg-white px-4 py-2 font-black">Назад</Link></div></header>
    <p className="mt-4 text-xs text-kv-muted">Снимок: {new Date(data.generatedAt).toISOString()}</p>

    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricList title="Регистрации" values={data.submissionsByStatus}/><MetricList title="Identity-профили" values={data.profilesByStatus}/><MetricList title="Проверки за 24 часа" values={data.checksLast24HoursByStatus}/><MetricList title="Фоновые задания" values={data.jobsByStatus}/></div>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Права представления агентств</h2><p className="mt-1 text-sm text-kv-muted">Статус ATTESTED создаётся автоматически после заявления агентства, наличия документов и привязанного корпоративного кошелька. Владелец платформы вмешивается только при споре или нарушении.</p><div className="mt-3 grid gap-3">{data.representationRights.map((item) => <article key={item.id} className="rounded border border-kv-line bg-kv-bg p-3"><div className="font-black">{item.title}</div><div className="mt-1 text-xs text-kv-muted">{item.organization} · {item.office} · {item.rightType} · {item.status}</div><div className="mt-1 break-all font-mono text-xs text-kv-muted">Кошелёк: {item.corporateWallet ?? "не привязан"}<br/>Evidence hash: {item.evidenceHash ?? "нет"}</div>{item.auditReason ? <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">Последняя причина аудита: {item.auditReason}</p> : null}{!["REVOKED", "EXPIRED"].includes(item.status) ? <form action={auditRepresentationAction} className="mt-3 grid gap-2 md:grid-cols-[160px_1fr_auto]"><input type="hidden" name="id" value={item.id}/><select name="action" className="min-h-11 rounded border border-kv-line bg-white px-3"><option value="DISPUTE">Оспорить</option><option value="SUSPEND">Приостановить</option><option value="REVOKE">Отозвать</option></select><input name="reason" required minLength={10} placeholder="Причина аудита (не менее 10 символов)" className="min-h-11 rounded border border-kv-line bg-white px-3"/><button className="rounded bg-kv-red px-4 py-2 font-black text-white">Применить</button></form> : null}</article>)}{data.representationRights.length ? null : <p className="text-sm text-kv-muted">Активных или спорных прав пока нет.</p>}</div></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Публикации</h2><p className="mt-1 text-sm text-kv-muted">Информационный список. Активировать обычную публикацию вручную здесь нельзя.</p><div className="mt-3 grid gap-2">{data.publicationGrants.map((item) => <div key={item.id} className="rounded bg-kv-bg p-3 text-sm"><b>{item.surface}</b><div className="text-xs text-kv-muted">объект {item.propertyObjectId} · право {item.representationStatus} · offer {item.offerStatus} · grant {item.status}</div></div>)}{data.publicationGrants.length ? null : <p className="text-sm text-kv-muted">Публикаций пока нет.</p>}</div></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Правила включения</h2><p className="mt-1 text-sm text-kv-muted">Mainnet-запись включается отдельно только после успешного dev E2E. Rollout не меняет владельца контракта и не создаёт ручное согласование заявок.</p><div className="mt-3 grid gap-3">{data.rolloutPolicies.map((item) => <form action={updateRolloutPolicyAction} key={item.id} className="rounded border border-kv-line bg-kv-bg p-3"><input type="hidden" name="id" value={item.id}/><input type="hidden" name="expectedVersion" value={item.version}/><div className="flex flex-wrap gap-3 text-sm"><b>{item.scope}</b><span>{item.organizationId ?? item.marketId ?? "global"}</span><span>v{item.version}</span></div><div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]"><select name="mode" defaultValue={item.mode} className="min-h-11 rounded border border-kv-line bg-white px-3"><option value="DISABLED">DISABLED</option><option value="NEW_SUBMISSIONS_ONLY">NEW_SUBMISSIONS_ONLY</option><option value="STRICT">STRICT</option></select><label className="flex items-center gap-2 rounded border border-kv-line bg-white px-3"><input type="checkbox" name="registryEnabled" defaultChecked={item.registryEnabled}/> Registry</label><label className="flex items-center gap-2 rounded border border-kv-line bg-white px-3"><input type="checkbox" name="publishGateEnabled" defaultChecked={item.publishGateEnabled}/> Publish gate</label></div><div className="mt-2 flex flex-col gap-2 md:flex-row"><input name="reason" required minLength={10} placeholder="Причина изменения rollout" className="min-h-11 flex-1 rounded border border-kv-line bg-white px-3"/><button className="rounded bg-kv-navy px-4 py-2 font-black text-white">Сохранить rollout</button></div></form>)}</div></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Официальные идентификаторы</h2><div className="mt-3 grid gap-2">{data.authorityPolicies.map((item) => <div key={item.id} className="rounded bg-kv-bg p-3 text-sm"><b>{item.jurisdiction} · {item.identifierScheme}</b><div className="text-xs text-kv-muted">{item.authorityNamespacePattern} · {item.active ? "active" : "inactive"} · v{item.version}</div></div>)}</div></section>
    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Последние события</h2><ol className="mt-3 grid gap-2 text-sm">{data.recentEvents.map((item) => <li key={item.id} className="rounded bg-kv-bg p-3"><b>{item.eventType}</b> · {item.previousStatus ?? "—"} → {item.nextStatus ?? "—"}<div className="text-xs text-kv-muted">{new Date(item.createdAt).toISOString()} · операция {item.submissionId ?? "—"} · {item.reasonCode ?? "—"}</div></li>)}</ol></section>
  </div></main>;
}
