import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "../../../lib/auth";
import { fetchSecureActorBackendJson, writeSecureActorBackendJson } from "../../../lib/server-api";

export const dynamic = "force-dynamic";

type Web3Response = {
  chain: { chainId: number; name: string; explorerUrl: string; production: boolean };
  organizations: Array<{ id: string; slug: string; legalName: string }>;
  wallets: Array<{ id: string; organizationId: string; walletAddress: string; chainId: number; safeVersion: string | null; status: string; threshold: number | null; ownerCount: number | null; organization: { legalName: string }; challenge: null | { messageHash: string; typedData: unknown } }>;
  contracts: Array<{ id: string; chainId: number; contractAddress: string; version: string; status: string; active: boolean; explorerUrl: string | null }>;
  eligibleProfiles: Array<{ id: string; stableId: string; title: string; token: null | { id: string; status: string } }>;
  tokens: Array<{ id: string; tokenId: string; status: string; reconciliationStatus: string; contractAddress: string; ownerAddress: string; identityProfile: { stableId: string }; ownerWallet: { organization: { legalName: string } } }>;
  operations: Array<{ id: string; operationType: string; status: string; chainTxHash: string | null; registrySafeTxHash: string | null; createdAt: string; identityProfile: { stableId: string } }>;
  issues: Array<{ id: string; issueType: string; status: string; publicStatus: string; detectedAt: string }>;
};

function value(formData: FormData, key: string) { const item = formData.get(key); return typeof item === "string" ? item.trim() : ""; }

async function issueWalletChallenge(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/corporate-wallets/challenge", "POST", { organizationId: value(formData, "organizationId"), walletAddress: value(formData, "walletAddress"), chainId: Number(value(formData, "chainId")) }, { "Idempotency-Key": `wallet-challenge:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function verifyWallet(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/corporate-wallets/verify", "POST", { walletId: value(formData, "walletId"), signature: value(formData, "signature") }, { "Idempotency-Key": `wallet-verify:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function queueTokenOperation(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/token-operations", "POST", { identityProfileId: value(formData, "identityProfileId"), operationType: value(formData, "operationType"), reason: value(formData, "reason"), targetAddress: value(formData, "targetAddress"), tokenUri: value(formData, "tokenUri") }, { "Idempotency-Key": `token-operation:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function recordChainTransaction(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  const operationId = value(formData, "operationId");
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/web3/token-operations/${encodeURIComponent(operationId)}/record-chain-tx`, "POST", { chainTxHash: value(formData, "chainTxHash"), registrySafeTxHash: value(formData, "registrySafeTxHash") }, { "Idempotency-Key": `record-chain-tx:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function reconcileToken(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  const tokenId = value(formData, "tokenId");
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/web3/tokens/${encodeURIComponent(tokenId)}/reconcile`, "POST", {}, { "Idempotency-Key": `reconcile:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

export default async function PropertyIdentityWeb3Page() {
  await requirePlatformOwner();
  const data = await fetchSecureActorBackendJson<Web3Response>(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3");
  return <main className="min-h-screen bg-kv-bg p-6 text-kv-ink"><div className="mx-auto max-w-[1280px]">
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="text-xs font-black uppercase tracking-[.18em] text-kv-red">Только владелец платформы</div><h1 className="mt-2 text-3xl font-black text-kv-navy">Web3, Corporate Safe и токены identity</h1><p className="mt-2 max-w-3xl text-sm text-kv-muted">Сеть: {data.chain.name} · chain {data.chain.chainId}. Система не хранит private keys. Все операции токена только ставятся в очередь и требуют подписи IREPN Registry/Admin Safe.</p>{data.chain.production ? <p className="mt-2 rounded bg-red-50 p-3 text-sm font-black text-red-700">Mainnet: запись заблокирована без отдельного deployment-разрешения.</p> : null}</div><Link href="/property-identity" className="rounded-full border border-kv-line bg-white px-4 py-2 font-black">К реестру</Link></header>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Привязать корпоративный Safe</h2><p className="mt-1 text-sm text-kv-muted">Сначала создаётся EIP-712 challenge. Safe должен подтвердить его контрактной подписью EIP-1271. Для ACTIVE требуются минимум два owner и threshold 2.</p><form action={issueWalletChallenge} className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]"><input type="hidden" name="chainId" value={data.chain.chainId}/><select name="organizationId" required className="min-h-11 rounded border border-kv-line px-3">{data.organizations.map(item => <option key={item.id} value={item.id}>{item.legalName}</option>)}</select><input name="walletAddress" required placeholder="0x Corporate Safe address" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><button className="rounded bg-kv-navy px-4 py-2 font-black text-white">Создать challenge</button></form></section>

    <section className="mt-6 grid gap-4">{data.wallets.map(wallet => <article key={wallet.id} className="rounded-md border border-kv-line bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black text-kv-navy">{wallet.organization.legalName}</h2><div className="text-xs font-mono text-kv-muted">{wallet.walletAddress}</div></div><span className="rounded-full bg-kv-bg px-3 py-1 text-xs font-black">{wallet.status} · {wallet.threshold ?? "—"}/{wallet.ownerCount ?? "—"}</span></div>{wallet.challenge ? <div className="mt-3"><div className="text-xs font-black">Message hash: <span className="font-mono">{wallet.challenge.messageHash}</span></div><textarea readOnly value={JSON.stringify(wallet.challenge.typedData, null, 2)} className="mt-2 h-48 w-full rounded border border-kv-line bg-kv-bg p-3 font-mono text-xs"/><form action={verifyWallet} className="mt-2 flex flex-col gap-2 md:flex-row"><input type="hidden" name="walletId" value={wallet.id}/><input name="signature" required placeholder="0x EIP-1271 Safe signature" className="min-h-11 flex-1 rounded border border-kv-line px-3 font-mono"/><button className="rounded bg-kv-navy px-4 py-2 font-black text-white">Проверить Safe</button></form></div> : null}</article>)}</section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Поставить операцию токена в Safe-очередь</h2><form action={queueTokenOperation} className="mt-3 grid gap-2"><div className="grid gap-2 md:grid-cols-2"><select name="identityProfileId" required className="min-h-11 rounded border border-kv-line px-3">{data.eligibleProfiles.map(item => <option key={item.id} value={item.id}>{item.title} · {item.stableId} · {item.token?.status ?? "без токена"}</option>)}</select><select name="operationType" className="min-h-11 rounded border border-kv-line px-3"><option value="MINT">MINT</option><option value="UPDATE_HASHES">UPDATE HASHES</option><option value="SUSPEND">SUSPEND</option><option value="UNSUSPEND">UNSUSPEND</option><option value="REVOKE">REVOKE</option><option value="REASSIGN">REASSIGN</option></select></div><input name="tokenUri" placeholder="Privacy-safe metadata URI (для MINT)" className="min-h-11 rounded border border-kv-line px-3"/><input name="targetAddress" placeholder="Новый Corporate Safe (только REASSIGN)" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><textarea name="reason" required minLength={10} placeholder="Основание операции" className="min-h-24 rounded border border-kv-line p-3"/><button className="justify-self-start rounded bg-kv-navy px-5 py-3 font-black text-white">Создать Safe-операцию</button></form></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Очередь Registry/Admin Safe</h2><div className="mt-3 grid gap-2">{data.operations.map(item => <div key={item.id} className="rounded bg-kv-bg p-3 text-sm"><b>{item.operationType}</b> · {item.identityProfile.stableId} · {item.status}<div className="text-xs text-kv-muted">{new Date(item.createdAt).toISOString()} · Safe tx {item.registrySafeTxHash ?? "ожидается"} · chain tx {item.chainTxHash ?? "ожидается"}</div>{["PENDING_REGISTRY_SAFE", "READY_TO_EXECUTE", "SUBMITTED"].includes(item.status) ? <form action={recordChainTransaction} className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="operationId" value={item.id}/><input name="registrySafeTxHash" placeholder="Safe tx hash" className="min-h-10 rounded border border-kv-line bg-white px-3 font-mono"/><input name="chainTxHash" required placeholder="0x chain transaction hash" className="min-h-10 rounded border border-kv-line bg-white px-3 font-mono"/><button className="rounded bg-kv-navy px-3 py-2 font-black text-white">Записать tx</button></form> : null}</div>)}</div></section>
    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Reconciliation</h2><div className="mt-3 grid gap-2">{data.tokens.map(item => <div key={item.id} className="rounded bg-kv-bg p-3 text-sm"><b>{item.identityProfile.stableId}</b> · token {item.tokenId} · {item.status}<div className="text-xs text-kv-muted">{item.ownerWallet.organization.legalName} · {item.ownerAddress} · {item.reconciliationStatus}</div><form action={reconcileToken} className="mt-2"><input type="hidden" name="tokenId" value={item.id}/><button className="rounded border border-kv-line bg-white px-3 py-2 font-black">Сверить с блокчейном</button></form></div>)}{data.issues.map(item => <div key={item.id} className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><b>{item.issueType}</b> · {item.status} · {item.publicStatus}</div>)}</div></section>
  </div></main>;
}
