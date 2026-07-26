import Link from "next/link";
import { fetchBackendJson } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type Verification = {
  stableId: string;
  identityStatus: string;
  publicStatus: string;
  subjectScope: string;
  jurisdiction: string;
  canonicalVersion: null | { versionNumber: number; snapshotHash: string; createdAt: string };
  token: null | { tokenId: string; chainId: number; contractAddress: string; corporateSafe: string; originatorOrganization: string; status: string; reconciliationStatus: string; issuedAt: string | null; lastReconciledAt: string | null; transactionUrl: string | null; contractUrl: string };
  disclaimer: string;
};

export default async function VerifyPropertyIdentityPage({ params }: { params: Promise<{ stableId: string }> }) {
  const { stableId } = await params;
  const result = await fetchBackendJson<Verification>(process.env.PUBLIC_API_BASE_URL, `/api/v1/public/property-identity/${encodeURIComponent(stableId)}`);
  if (!result) return <main className="min-h-screen bg-kv-bg p-6"><div className="mx-auto max-w-3xl rounded-md border border-kv-line bg-white p-6"><h1 className="text-2xl font-black text-kv-navy">Identity не найдена</h1><p className="mt-2 text-kv-muted">Проверьте идентификатор или ссылку.</p><Link href="/" className="mt-4 inline-block font-black text-kv-red">На главную</Link></div></main>;
  const verified = result.publicStatus === "VERIFIED";
  return <main className="min-h-screen bg-kv-bg p-6 text-kv-ink"><div className="mx-auto max-w-3xl">
    <div className="rounded-md border border-kv-line bg-white p-6"><div className="text-xs font-black uppercase tracking-[.18em] text-kv-red">IREPN Property Identity</div><h1 className="mt-2 break-all text-3xl font-black text-kv-navy">{result.stableId}</h1><div className={`mt-4 rounded p-4 font-black ${verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{result.publicStatus}</div><dl className="mt-6 grid gap-3 text-sm md:grid-cols-2"><div><dt className="font-black">Юрисдикция</dt><dd>{result.jurisdiction}</dd></div><div><dt className="font-black">Физический scope</dt><dd>{result.subjectScope}</dd></div><div><dt className="font-black">Identity status</dt><dd>{result.identityStatus}</dd></div><div><dt className="font-black">Canonical version</dt><dd>{result.canonicalVersion ? `v${result.canonicalVersion.versionNumber} · ${result.canonicalVersion.snapshotHash}` : "—"}</dd></div></dl>
      {result.token ? <section className="mt-6 rounded bg-kv-bg p-4"><h2 className="font-black text-kv-navy">BNB Smart Chain</h2><dl className="mt-3 grid gap-2 text-sm"><div><dt className="font-black">Token ID</dt><dd className="break-all font-mono">{result.token.tokenId}</dd></div><div><dt className="font-black">Corporate Safe</dt><dd className="break-all font-mono">{result.token.corporateSafe}</dd></div><div><dt className="font-black">Originator</dt><dd>{result.token.originatorOrganization}</dd></div><div><dt className="font-black">Reconciliation</dt><dd>{result.token.reconciliationStatus}</dd></div></dl><div className="mt-3 flex gap-3"><a href={result.token.contractUrl} rel="noreferrer" target="_blank" className="font-black text-kv-red">Контракт</a>{result.token.transactionUrl ? <a href={result.token.transactionUrl} rel="noreferrer" target="_blank" className="font-black text-kv-red">Транзакция</a> : null}</div></section> : <p className="mt-6 rounded bg-amber-50 p-4 text-sm text-amber-800">Off-chain identity существует, токен ещё не выпущен или не прошёл reconciliation.</p>}
      <p className="mt-6 border-t border-kv-line pt-4 text-xs text-kv-muted">{result.disclaimer}</p><Link href="/" className="mt-4 inline-block font-black text-kv-red">На главную</Link>
    </div>
  </div></main>;
}
