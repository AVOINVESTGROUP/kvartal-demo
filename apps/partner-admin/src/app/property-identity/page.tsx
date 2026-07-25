import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../lib/auth";
import { fetchSecureActorBackendJson, writeSecureActorBackendJson } from "../../lib/server-api";

export const dynamic = "force-dynamic";

type RegistryContext = {
  offices: Array<{ id: string; organizationId: string; legalName: string; organizationName: string; city: string; country: string; defaultMarketId: string | null }>;
  markets: Array<{ id: string; slug: string; city: string; country: string; assetClasses: string[]; defaultCurrency: string }>;
  rollout: Array<{ organizationId: string; officeId: string; marketId: string; rollout: { registryEnabled: boolean; publishGateEnabled: boolean; mode: string } }>;
  authorityPolicies: Array<{ id: string; organizationId: string | null; marketId: string | null; jurisdiction: string; assetClass: string | null; subjectScope: string; identifierScheme: string; authorityNamespacePattern: string; automaticExactMatchAllowed: boolean; version: number }>;
};

type Submission = {
  id: string;
  organizationId: string;
  officeId: string;
  marketId: string;
  status: string;
  subjectScope: string;
  jurisdiction: string;
  assetClass: string;
  identityInput: Record<string, unknown>;
  canonicalPropertyObjectId: string | null;
  rowVersion: number;
  updatedAt: string;
  observations: Array<{ id: string; scheme: string; authorityNamespace: string; normalizerId: string; normalizerVersion: number; status: string; correctionReason: string | null }>;
  checkRuns: Array<{ id: string; status: string; outcome: string | null; redactedResult: unknown; createdAt: string }>;
  confirmations: Array<{ id: string; resolution: string; createdAt: string }>;
};

const apiBase = () => process.env.OFFICE_API_BASE_URL ?? process.env.PARTNER_API_BASE_URL;
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";
const numeric = (data: FormData, key: string) => value(data, key) || undefined;

function backendError(caught: unknown) {
  const error = caught as { digest?: string; message?: string; payload?: { error?: { code?: string; message?: string } } };
  if (error.digest?.startsWith("NEXT_REDIRECT")) throw caught;
  return `${error.payload?.error?.code ?? "REGISTRY_ERROR"}: ${error.payload?.error?.message ?? error.message ?? "Операция не выполнена"}`;
}

function returnToRegistry(error: string, submissionId?: string): never {
  redirect(`/property-identity?${submissionId ? `submissionId=${encodeURIComponent(submissionId)}&` : ""}error=${encodeURIComponent(error)}`);
}

async function createSubmissionAction(data: FormData) {
  "use server";
  await requireAdminSession();
  const identifiers = [1, 2, 3].map((index) => ({
    scheme: value(data, `scheme${index}`),
    authorityNamespace: value(data, `namespace${index}`),
    rawValue: value(data, `identifier${index}`),
    sourceType: "manual",
  })).filter((identifier) => identifier.scheme || identifier.authorityNamespace || identifier.rawValue);
  try {
    const result = await writeSecureActorBackendJson<{ submissionId: string }>(apiBase(), "/api/v1/admin/property-identity/submissions", "POST", {
      organizationId: value(data, "organizationId"),
      officeId: value(data, "officeId"),
      marketId: value(data, "marketId"),
      jurisdiction: value(data, "jurisdiction"),
      subjectScope: value(data, "subjectScope"),
      assetClass: value(data, "assetClass"),
      identityInput: {
        title: value(data, "title"),
        titleEn: value(data, "titleEn"),
        description: value(data, "description"),
        descriptionEn: value(data, "descriptionEn"),
        addressDisplay: value(data, "addressDisplay"),
        addressDisplayEn: value(data, "addressDisplayEn"),
        addressPrivate: value(data, "addressDisplay"),
        assetSubtype: value(data, "assetSubtype"),
        areaSqm: numeric(data, "areaSqm"),
        landAreaSqm: numeric(data, "landAreaSqm"),
        floorNumber: numeric(data, "floorNumber"),
        floorsTotal: numeric(data, "floorsTotal"),
        roomsCount: numeric(data, "roomsCount"),
      },
      identifiers,
    }, { "idempotency-key": randomUUID() });
    revalidatePath("/property-identity");
    redirect(`/property-identity?submissionId=${encodeURIComponent(result.submissionId)}&message=${encodeURIComponent("Заявка сохранена. Теперь запустите проверку.")}`);
  } catch (caught) { returnToRegistry(backendError(caught)); }
}

async function correctSubmissionAction(data: FormData) {
  "use server";
  await requireAdminSession();
  const submissionId = value(data, "submissionId");
  try {
    await writeSecureActorBackendJson(apiBase(), `/api/v1/admin/property-identity/submissions/${encodeURIComponent(submissionId)}`, "PATCH", {
      identifiers: [{ scheme: value(data, "scheme"), authorityNamespace: value(data, "namespace"), rawValue: value(data, "identifier"), sourceType: "manual" }],
    }, { "idempotency-key": randomUUID(), "if-match": `"${value(data, "rowVersion")}"` });
    revalidatePath("/property-identity");
    redirect(`/property-identity?submissionId=${encodeURIComponent(submissionId)}&message=${encodeURIComponent("Исправления сохранены. Запустите проверку ещё раз.")}`);
  } catch (caught) { returnToRegistry(backendError(caught), submissionId); }
}

async function checkSubmissionAction(data: FormData) {
  "use server";
  await requireAdminSession();
  const submissionId = value(data, "submissionId");
  try {
    await writeSecureActorBackendJson(apiBase(), `/api/v1/admin/property-identity/submissions/${encodeURIComponent(submissionId)}/check`, "POST", {}, { "idempotency-key": randomUUID() });
    revalidatePath("/property-identity");
    redirect(`/property-identity?submissionId=${encodeURIComponent(submissionId)}&message=${encodeURIComponent("Проверка завершена. Выберите разрешённое действие.")}`);
  } catch (caught) { returnToRegistry(backendError(caught), submissionId); }
}

async function confirmSubmissionAction(data: FormData) {
  "use server";
  await requireAdminSession();
  const submissionId = value(data, "submissionId");
  const resolution = value(data, "resolution");
  const command = resolution === "LINK_EXISTING" ? "confirm-link" : "confirm-create";
  try {
    await writeSecureActorBackendJson(apiBase(), `/api/v1/admin/property-identity/submissions/${encodeURIComponent(submissionId)}/${command}`, "POST", {
      checkRunId: value(data, "checkRunId"),
      reason: value(data, "reason") || undefined,
    }, { "idempotency-key": randomUUID() });
    revalidatePath("/property-identity");
    revalidatePath("/");
    redirect(`/property-identity?submissionId=${encodeURIComponent(submissionId)}&message=${encodeURIComponent(resolution === "LINK_EXISTING" ? "Заявка привязана к существующему объекту." : "Канонический объект создан.")}`);
  } catch (caught) { returnToRegistry(backendError(caught), submissionId); }
}

async function cancelSubmissionAction(data: FormData) {
  "use server";
  await requireAdminSession();
  const submissionId = value(data, "submissionId");
  try {
    await writeSecureActorBackendJson(apiBase(), `/api/v1/admin/property-identity/submissions/${encodeURIComponent(submissionId)}/cancel`, "POST", { reason: value(data, "reason") || "cancelled_by_author" }, { "idempotency-key": randomUUID() });
    revalidatePath("/property-identity");
    redirect(`/property-identity?submissionId=${encodeURIComponent(submissionId)}&message=${encodeURIComponent("Заявка отменена автором.")}`);
  } catch (caught) { returnToRegistry(backendError(caught), submissionId); }
}

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик — готов к проверке",
  NEEDS_CORRECTION: "Нужно исправить данные",
  UNIQUE_CANDIDATE: "Совпадений нет — можно создать объект",
  EXACT_EXISTING: "Найден существующий объект — можно связать",
  STRONG_IDENTIFIER_CONFLICT: "Конфликт сильных идентификаторов",
  CLOSED: "Завершено",
  CANCELLED: "Отменено автором",
};

export default async function PropertyIdentityPage({ searchParams }: { searchParams?: Promise<{ submissionId?: string; officeId?: string; error?: string; message?: string }> }) {
  await requireAdminSession();
  const params = await searchParams ?? {};
  const context = await fetchSecureActorBackendJson<RegistryContext>(apiBase(), "/api/v1/admin/property-identity/context");
  const office = context.offices.find((item) => item.id === params.officeId) ?? context.offices[0];
  const enabledMarketIds = new Set(context.rollout.filter((item) => item.organizationId === office?.organizationId && item.officeId === office?.id && item.rollout.registryEnabled).map((item) => item.marketId));
  const markets = context.markets.filter((market) => enabledMarketIds.has(market.id));
  const submissions = office ? (await fetchSecureActorBackendJson<{ submissions: Submission[] }>(apiBase(), `/api/v1/admin/property-identity/submissions?organizationId=${encodeURIComponent(office.organizationId)}&officeId=${encodeURIComponent(office.id)}&limit=100`)).submissions : [];
  const selectedSummary = submissions.find((item) => item.id === params.submissionId) ?? submissions[0];
  const selected = selectedSummary ? (await fetchSecureActorBackendJson<{ submission: Submission }>(apiBase(), `/api/v1/admin/property-identity/submissions/${encodeURIComponent(selectedSummary.id)}`)).submission : null;
  const latestRun = selected?.checkRuns[0];
  const defaultMarket = markets.find((market) => market.id === office?.defaultMarketId) ?? markets[0];
  const policies = context.authorityPolicies.filter((policy) => (!policy.organizationId || policy.organizationId === office?.organizationId) && (!policy.marketId || policy.marketId === defaultMarket?.id));

  return <main className="min-h-screen bg-kv-bg px-5 py-6 text-kv-ink">
    <div className="mx-auto max-w-[1440px] space-y-5">
      <header className="flex flex-col gap-3 rounded-md border border-kv-line bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="text-[12px] font-black uppercase tracking-[0.16em] text-kv-red">Property Identity Registry</div><h1 className="mt-1 text-2xl font-black text-kv-navy">Регистрация физического объекта</h1><p className="mt-2 text-sm text-kv-muted">Заявку создаёте, исправляете и завершаете вы сами. Платформа не рассматривает обычные заявки.</p></div>
        <div className="flex gap-2"><a href="/" className="rounded-full border border-kv-line px-4 py-2 text-sm font-black text-kv-navy">Назад к объектам</a><a href="/logout" className="rounded-full bg-kv-navy px-4 py-2 text-sm font-black text-white">Выйти</a></div>
      </header>
      {params.error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{params.error}</div> : null}
      {params.message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{params.message}</div> : null}

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <div className="rounded-md border border-kv-line bg-white p-4">
            <h2 className="font-black text-kv-navy">Мои заявки</h2>
            <div className="mt-3 space-y-2">{submissions.map((item) => <a key={item.id} href={`/property-identity?officeId=${encodeURIComponent(office.id)}&submissionId=${encodeURIComponent(item.id)}`} className={`block rounded-md border p-3 ${selected?.id === item.id ? "border-kv-navy bg-kv-bg" : "border-kv-line"}`}><div className="font-black text-kv-navy">{String(item.identityInput?.title ?? `${item.assetClass} · ${item.jurisdiction}`)}</div><div className="mt-1 text-xs text-kv-muted">{statusLabels[item.status] ?? item.status}</div></a>)}</div>
            {!submissions.length ? <p className="mt-3 text-sm text-kv-muted">У вас пока нет заявок.</p> : null}
          </div>
          <details className="rounded-md border border-kv-line bg-white" open={!selected}>
            <summary className="cursor-pointer p-4 font-black text-kv-navy">Новая заявка</summary>
            {!markets.length ? <p className="border-t border-kv-line p-4 text-sm font-bold text-amber-700">Реестр ещё не включён для доступных рынков. Старый рабочий контур продолжает работать.</p> : <form action={createSubmissionAction} className="grid gap-3 border-t border-kv-line p-4">
              <input type="hidden" name="organizationId" value={office.organizationId}/><input type="hidden" name="officeId" value={office.id}/>
              <label className="text-sm font-bold">Рынок<select name="marketId" defaultValue={defaultMarket?.id} className="mt-1 h-10 w-full rounded border border-kv-line px-3">{markets.map((market) => <option key={market.id} value={market.id}>{market.city}, {market.country}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-2"><label className="text-sm font-bold">Юрисдикция<input name="jurisdiction" required maxLength={16} placeholder="RU / GE / AE" className="mt-1 h-10 w-full rounded border border-kv-line px-3"/></label><label className="text-sm font-bold">Уровень<select name="subjectScope" defaultValue="UNIT" className="mt-1 h-10 w-full rounded border border-kv-line px-3"><option value="UNIT">Помещение / квартира</option><option value="BUILDING">Здание</option><option value="LAND_PARCEL">Земельный участок</option><option value="PROJECT">Проект</option></select></label></div>
              <label className="text-sm font-bold">Класс объекта<select name="assetClass" defaultValue="apartment" className="mt-1 h-10 w-full rounded border border-kv-line px-3">{[...new Set(markets.flatMap((market) => market.assetClasses))].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <input name="assetSubtype" placeholder="Подтип" className="h-10 rounded border border-kv-line px-3"/><input name="title" required placeholder="Название объекта" className="h-10 rounded border border-kv-line px-3"/><input name="addressDisplay" required placeholder="Адрес" className="h-10 rounded border border-kv-line px-3"/><textarea name="description" placeholder="Описание" className="min-h-20 rounded border border-kv-line p-3"/>
              <div className="grid grid-cols-3 gap-2"><input name="areaSqm" inputMode="decimal" placeholder="Площадь, м²" className="h-10 rounded border border-kv-line px-3"/><input name="floorNumber" inputMode="numeric" placeholder="Этаж" className="h-10 rounded border border-kv-line px-3"/><input name="roomsCount" inputMode="numeric" placeholder="Комнат" className="h-10 rounded border border-kv-line px-3"/></div>
              <div className="rounded border border-kv-line bg-kv-bg p-3"><div className="text-sm font-black text-kv-navy">Официальный идентификатор</div><input name="scheme1" list="identity-schemes" required placeholder="Схема, например CADASTRAL_ID" className="mt-2 h-10 w-full rounded border border-kv-line px-3"/><input name="namespace1" required placeholder="Орган / namespace" className="mt-2 h-10 w-full rounded border border-kv-line px-3"/><input name="identifier1" required placeholder="Значение идентификатора" className="mt-2 h-10 w-full rounded border border-kv-line px-3"/><datalist id="identity-schemes">{[...new Set(policies.map((policy) => policy.identifierScheme))].map((scheme) => <option key={scheme} value={scheme}/>)}</datalist><p className="mt-2 text-xs text-kv-muted">Допустимые namespace: {[...new Set(policies.map((policy) => policy.authorityNamespacePattern))].join(", ") || "уточните у администратора политики"}</p></div>
              <button className="rounded-full bg-kv-red px-5 py-3 text-sm font-black text-white">Сохранить заявку</button>
            </form>}
          </details>
        </div>

        <div className="rounded-md border border-kv-line bg-white p-5">{selected ? <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-kv-navy">{String(selected.identityInput?.title ?? "Заявка")}</h2><p className="mt-1 text-sm text-kv-muted">{statusLabels[selected.status] ?? selected.status} · версия {selected.rowVersion}</p></div>{selected.canonicalPropertyObjectId ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Object ID: {selected.canonicalPropertyObjectId}</span> : null}</div>
          <div className="grid gap-3 md:grid-cols-3"><div className="rounded border border-kv-line p-3"><div className="text-xs text-kv-muted">Юрисдикция</div><div className="font-black">{selected.jurisdiction}</div></div><div className="rounded border border-kv-line p-3"><div className="text-xs text-kv-muted">Уровень</div><div className="font-black">{selected.subjectScope}</div></div><div className="rounded border border-kv-line p-3"><div className="text-xs text-kv-muted">Класс</div><div className="font-black">{selected.assetClass}</div></div></div>
          <div><h3 className="font-black text-kv-navy">Идентификаторы</h3><div className="mt-2 space-y-2">{selected.observations.map((item) => <div key={item.id} className="rounded border border-kv-line p-3 text-sm"><div className="font-black">{item.scheme} · {item.authorityNamespace}</div><div className="mt-1 text-kv-muted">{item.status}{item.correctionReason ? ` — ${item.correctionReason}` : ""}</div></div>)}</div></div>
          {!['CLOSED','CANCELLED'].includes(selected.status) ? <form action={correctSubmissionAction} className="grid gap-2 rounded border border-amber-200 bg-amber-50 p-4"><input type="hidden" name="submissionId" value={selected.id}/><input type="hidden" name="rowVersion" value={selected.rowVersion}/><div className="font-black text-amber-800">{selected.status === "NEEDS_CORRECTION" || selected.status === "STRONG_IDENTIFIER_CONFLICT" ? "Исправить идентификатор" : "Изменить идентификатор и проверить заново"}</div><input name="scheme" required placeholder="Схема" className="h-10 rounded border border-amber-200 px-3"/><input name="namespace" required placeholder="Namespace" className="h-10 rounded border border-amber-200 px-3"/><input name="identifier" required placeholder="Значение" className="h-10 rounded border border-amber-200 px-3"/><button className="rounded-full bg-amber-600 px-4 py-2 text-sm font-black text-white">Сохранить изменение</button></form> : null}
          {!['CLOSED','CANCELLED'].includes(selected.status) && selected.status !== "NEEDS_CORRECTION" ? <form action={checkSubmissionAction}><input type="hidden" name="submissionId" value={selected.id}/><button className="rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Проверить совпадения</button></form> : null}
          {latestRun ? <div className="rounded border border-kv-line bg-kv-bg p-4"><div className="font-black text-kv-navy">Последняя проверка: {latestRun.outcome}</div><p className="mt-1 text-sm text-kv-muted">Результат не раскрывает чужие конфиденциальные данные.</p></div> : null}
          {(selected.status === "UNIQUE_CANDIDATE" || selected.status === "EXACT_EXISTING") && latestRun ? <form action={confirmSubmissionAction} className="rounded border border-emerald-200 bg-emerald-50 p-4"><input type="hidden" name="submissionId" value={selected.id}/><input type="hidden" name="checkRunId" value={latestRun.id}/><input type="hidden" name="resolution" value={selected.status === "EXACT_EXISTING" ? "LINK_EXISTING" : "CREATE_NEW"}/><div className="font-black text-emerald-800">{selected.status === "EXACT_EXISTING" ? "Связать с найденным физическим объектом" : "Создать новый канонический объект"}</div><p className="mt-2 text-sm text-emerald-700">Этим действием автор подтверждает актуальность введённых данных.</p><input name="reason" placeholder="Комментарий (необязательно)" className="mt-3 h-10 w-full rounded border border-emerald-200 px-3"/><button className="mt-3 rounded-full bg-emerald-700 px-5 py-3 text-sm font-black text-white">Подтвердить и завершить</button></form> : null}
          {!['CLOSED','CANCELLED'].includes(selected.status) ? <form action={cancelSubmissionAction} className="flex items-center justify-between gap-3 rounded border border-red-200 bg-red-50 p-4"><input type="hidden" name="submissionId" value={selected.id}/><input type="hidden" name="reason" value="cancelled_by_author"/><span className="text-sm text-red-700">Отмена не удаляет аудит заявки.</span><button className="rounded-full border border-red-300 px-4 py-2 text-sm font-black text-red-700">Отменить заявку</button></form> : null}
          {selected.checkRuns.length ? <details><summary className="cursor-pointer font-black text-kv-navy">История проверок</summary><div className="mt-2 space-y-2">{selected.checkRuns.map((run) => <div key={run.id} className="rounded border border-kv-line p-2 text-sm">{new Date(run.createdAt).toLocaleString("ru-RU")} · {run.outcome ?? run.status}</div>)}</div></details> : null}
        </div> : <p className="text-kv-muted">Выберите заявку слева или создайте новую.</p>}</div>
      </section>
    </div>
  </main>;
}
