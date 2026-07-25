import Link from "next/link";
import { requirePlatformOwner } from "../../lib/auth";
import { fetchSecureActorBackendJson } from "../../lib/server-api";

export const dynamic = "force-dynamic";

type MonitoringResponse = {
  generatedAt: string;
  monitoringOnly: boolean;
  note: string;
  submissionsByStatus: Record<string, number>;
  profilesByStatus: Record<string, number>;
  checksLast24HoursByStatus: Record<string, number>;
  jobsByStatus: Record<string, number>;
  rolloutPolicies: Array<{ id: string; scope: string; organizationId: string | null; marketId: string | null; mode: string; registryEnabled: boolean; publishGateEnabled: boolean; activationAt: string | null; version: number }>;
  authorityPolicies: Array<{ id: string; jurisdiction: string; identifierScheme: string; authorityNamespacePattern: string; active: boolean; version: number }>;
  recentEvents: Array<{ id: string; submissionId: string | null; eventType: string; previousStatus: string | null; nextStatus: string | null; reasonCode: string | null; createdAt: string }>;
};

function MetricList({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values);
  return <section className="rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">{title}</h2><div className="mt-3 grid gap-2">{entries.length ? entries.map(([name, count]) => <div key={name} className="flex justify-between rounded bg-kv-bg p-3 text-sm"><span>{name}</span><b>{count}</b></div>) : <p className="text-sm text-kv-muted">Нет данных</p>}</div></section>;
}

export default async function PropertyIdentityMonitoringPage() {
  await requirePlatformOwner();
  const data = await fetchSecureActorBackendJson<MonitoringResponse>(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/monitoring");
  return <main className="min-h-screen bg-kv-bg p-6 text-kv-ink"><div className="mx-auto max-w-[1280px]">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="text-xs font-black uppercase tracking-[.18em] text-kv-red">Только мониторинг</div><h1 className="mt-2 text-3xl font-black text-kv-navy">Property Identity Registry</h1><p className="mt-2 max-w-3xl text-sm text-kv-muted">Заявки здесь не обрабатываются. Автор создаёт, исправляет и завершает свою заявку в кабинете партнёра. Platform Admin показывает состояние системы, правила включения и технические сбои.</p></div><Link href="/" className="self-start rounded-full border border-kv-line bg-white px-4 py-2 font-black">Назад</Link></div>
    <p className="mt-4 text-xs text-kv-muted">Снимок: {new Date(data.generatedAt).toISOString()}</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricList title="Заявки по статусам" values={data.submissionsByStatus}/><MetricList title="Профили объектов" values={data.profilesByStatus}/><MetricList title="Проверки за 24 часа" values={data.checksLast24HoursByStatus}/><MetricList title="Фоновые задания" values={data.jobsByStatus}/></div>
    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Правила включения</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Scope</th><th className="p-2">Режим</th><th className="p-2">Registry</th><th className="p-2">Publish gate</th><th className="p-2">Активация</th><th className="p-2">Версия</th></tr></thead><tbody>{data.rolloutPolicies.map(item => <tr key={item.id} className="border-b last:border-0"><td className="p-2">{item.scope}<div className="text-xs text-kv-muted">{item.organizationId ?? item.marketId ?? "global"}</div></td><td className="p-2 font-bold">{item.mode}</td><td className="p-2">{item.registryEnabled ? "ON" : "OFF"}</td><td className="p-2">{item.publishGateEnabled ? "ON" : "OFF"}</td><td className="p-2">{item.activationAt ? new Date(item.activationAt).toISOString() : "—"}</td><td className="p-2">v{item.version}</td></tr>)}</tbody></table>{data.rolloutPolicies.length ? null : <p className="py-4 text-sm text-kv-muted">Правила не созданы: реестр по умолчанию выключен.</p>}</div></section>
    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Политики источников идентификаторов</h2><div className="mt-3 grid gap-2">{data.authorityPolicies.map(item => <div key={item.id} className="rounded bg-kv-bg p-3 text-sm"><b>{item.jurisdiction} · {item.identifierScheme}</b><div className="text-xs text-kv-muted">{item.authorityNamespacePattern} · {item.active ? "active" : "inactive"} · v{item.version}</div></div>)}{data.authorityPolicies.length ? null : <p className="text-sm text-kv-muted">Активные политики отсутствуют.</p>}</div></section>
    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Последние события без чувствительных идентификаторов</h2><ol className="mt-3 grid gap-2 text-sm">{data.recentEvents.map(item => <li key={item.id} className="rounded bg-kv-bg p-3"><b>{item.eventType}</b> · {item.previousStatus ?? "—"} → {item.nextStatus ?? "—"}<div className="text-xs text-kv-muted">{new Date(item.createdAt).toISOString()} · заявка {item.submissionId ?? "—"} · {item.reasonCode ?? "—"}</div></li>)}</ol></section>
  </div></main>;
}
