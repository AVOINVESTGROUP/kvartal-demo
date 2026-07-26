import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "../../../lib/auth";
import { fetchSecureActorBackendJson, writeSecureActorBackendJson } from "../../../lib/server-api";
import registryArtifact from "../../../../../../packages/contracts/artifacts/contracts/Bep721PropertyIdentityToken.sol/Bep721PropertyIdentityToken.json";
import { RegistryContractDeploymentPanel, SafeDeploymentPanel, SafeExecutionButton, SafeOperationButton } from "./safe-operation-button";

export const dynamic = "force-dynamic";

type Web3Response = {
  chain: { chainId: number; name: string; explorerUrl: string; production: boolean; writesAllowed: boolean };
  readiness: { mainnetSelected: boolean; writesAllowed: boolean; safeTransactionServiceConfigured: boolean; activeRegistryContract: boolean; registryContractAddress: string | null; registryAdminSafeAddress: string | null; activeCorporateWalletCount: number; eligibleProfileCount: number; reconciledActiveTokenCount: number; readyForMint: boolean; firstTokenLive: boolean; nextAction: string };
  organizations: Array<{ id: string; slug: string; legalName: string }>;
  wallets: Array<{ id: string; organizationId: string; walletAddress: string; chainId: number; safeVersion: string | null; status: string; threshold: number | null; ownerCount: number | null; organization: { legalName: string }; challenge: null | { messageHash: string; typedData: unknown } }>;
  contracts: Array<{ id: string; chainId: number; contractAddress: string; registryAdminSafeAddress: string | null; version: string; abiHash: string; bytecodeHash: string | null; deploymentTxHash: string; deploymentBlockNumber: string | null; verifiedAt: string | null; status: string; active: boolean; explorerUrl: string | null }>;
  eligibleProfiles: Array<{ id: string; stableId: string; title: string; token: null | { id: string; status: string } }>;
  tokens: Array<{ id: string; tokenId: string; status: string; reconciliationStatus: string; contractAddress: string; ownerAddress: string; identityProfile: { stableId: string }; ownerWallet: { organization: { legalName: string } } }>;
  operations: Array<{ id: string; operationType: string; status: string; chainTxHash: string | null; registrySafeTxHash: string | null; payloadJson: unknown; createdAt: string; identityProfile: { stableId: string } }>;
  issues: Array<{ id: string; issueType: string; status: string; publicStatus: string; detectedAt: string }>;
};

function value(formData: FormData, key: string) { const item = formData.get(key); return typeof item === "string" ? item.trim() : ""; }

async function issueWalletChallenge(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/corporate-wallets/challenge", "POST", { organizationId: value(formData, "organizationId"), walletAddress: value(formData, "walletAddress"), chainId: Number(value(formData, "chainId")) }, { "Idempotency-Key": `wallet-challenge:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function registerContract(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/contracts/register", "POST", {
    contractAddress: value(formData, "contractAddress"),
    registryAdminSafeAddress: value(formData, "registryAdminSafeAddress"),
    deploymentTxHash: value(formData, "deploymentTxHash"),
    abiHash: value(formData, "abiHash"),
    version: value(formData, "version"),
    reason: value(formData, "reason"),
  }, { "Idempotency-Key": `contract-register:${crypto.randomUUID()}` });
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

async function proposeSafeTransaction(operationId: string, submission: { safeTransactionData: Record<string, unknown>; safeTxHash: string; senderAddress: string; senderSignature: string }) {
  "use server";
  await requirePlatformOwner();
  const result = await writeSecureActorBackendJson<{ ok: boolean; safeTxHash: string; requiredConfirmations: number }>(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/web3/token-operations/${encodeURIComponent(operationId)}/propose-safe-transaction`, "POST", submission, { "Idempotency-Key": `safe-proposal:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
  return result;
}

async function getSafeExecution(operationId: string) {
  "use server";
  await requirePlatformOwner();
  const result = await writeSecureActorBackendJson<{ status: string; confirmations: number; confirmationsRequired: number; chainTxHash: string | null; serviceTransaction: Record<string, unknown> }>(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/web3/token-operations/${encodeURIComponent(operationId)}/sync-safe-transaction`, "POST", {}, { "Idempotency-Key": `safe-execution:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
  return result;
}

async function recordSafeExecution(operationId: string, safeTxHash: string, chainTxHash: string) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/web3/token-operations/${encodeURIComponent(operationId)}/record-chain-tx`, "POST", { registrySafeTxHash: safeTxHash, chainTxHash }, { "Idempotency-Key": `safe-executed:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
  return { ok: true };
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
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="text-xs font-black uppercase tracking-[.18em] text-kv-red">Только владелец платформы</div><h1 className="mt-2 text-3xl font-black text-kv-navy">Web3, Corporate Safe и токены identity</h1><p className="mt-2 max-w-3xl text-sm text-kv-muted">Сеть: {data.chain.name} · chain {data.chain.chainId}. Система не хранит private keys. Все операции токена требуют подписи IREPN Registry/Admin Safe.</p>{data.chain.production ? <p className={`mt-2 rounded p-3 text-sm font-black ${data.chain.writesAllowed ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{data.chain.writesAllowed ? "BNB Smart Chain Mainnet: операции выполняются в реальной сети и требуют реального BNB." : "Mainnet выбран, но запись административно заблокирована."}</p> : <p className="mt-2 rounded bg-amber-50 p-3 text-sm font-black text-amber-800">Тестовая сеть. Этот режим не является production-запуском.</p>}</div><Link href="/property-identity" className="rounded-full border border-kv-line bg-white px-4 py-2 font-black">К реестру</Link></header>

    <section className={`mt-6 rounded-md border p-5 ${data.readiness.firstTokenLive ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><h2 className="text-xl font-black text-kv-navy">{data.readiness.firstTokenLive ? "Web3-реестр работает в Mainnet" : "Web3-реестр ещё не введён в работу"}</h2><p className="mt-1 text-sm text-kv-muted">Статус рассчитан API по реальной конфигурации, PostgreSQL и подтверждённым on-chain результатам.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${data.readiness.firstTokenLive ? "bg-green-700 text-white" : "bg-amber-200 text-amber-950"}`}>{data.readiness.firstTokenLive ? "РАБОТАЕТ" : "ТРЕБУЕТ ДЕЙСТВИЙ"}</span></div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {[
          ["BNB Mainnet (chain 56)", data.readiness.mainnetSelected, data.chain.name],
          ["Запись в Mainnet", data.readiness.writesAllowed, data.readiness.writesAllowed ? "разрешена" : "заблокирована"],
          ["Safe Transaction Service", data.readiness.safeTransactionServiceConfigured, data.readiness.safeTransactionServiceConfigured ? "настроен" : "не настроен"],
          ["Registry/Admin Safe и контракт", data.readiness.activeRegistryContract, data.readiness.registryContractAddress ?? "не созданы"],
          ["Corporate Safe агентства", data.readiness.activeCorporateWalletCount > 0, `${data.readiness.activeCorporateWalletCount} активных`],
          ["Первый токен сверён с блокчейном", data.readiness.firstTokenLive, `${data.readiness.reconciledActiveTokenCount} подтверждено`],
        ].map(([label, ok, detail]) => <div key={String(label)} className="rounded border border-black/10 bg-white p-3 text-sm"><div className="font-black">{ok ? "✓" : "○"} {label}</div><div className="mt-1 break-all text-xs text-kv-muted">{detail}</div></div>)}
      </div>
      <p className="mt-4 rounded bg-white p-3 text-sm font-black text-kv-navy">Следующий шаг: {{
        SELECT_BSC_MAINNET: "переключить API на BNB Smart Chain Mainnet.",
        ENABLE_MAINNET_WRITES: "разрешить запись в Mainnet в конфигурации API.",
        CONFIGURE_SAFE_TRANSACTION_SERVICE: "подключить Safe Transaction Service к API.",
        CREATE_REGISTRY_SAFE_AND_DEPLOY_CONTRACT: "создать Registry/Admin Safe 2-of-N и развернуть контракт кнопками ниже.",
        CONNECT_ORIGINATOR_CORPORATE_SAFE: "привязать Corporate Safe агентства — владельца первого объекта.",
        PREPARE_VERIFIED_PROPERTY: "создать или завершить проверку первого объекта в обычном кабинете партнёра.",
        MINT_AND_RECONCILE_FIRST_TOKEN: "выпустить первый токен через Safe и выполнить сверку.",
        FIRST_TOKEN_LIVE: "реестр введён в работу; можно выпускать токены следующих объектов.",
      }[data.readiness.nextAction] ?? "проверить конфигурацию Web3."}</p>
    </section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Привязать корпоративный Safe</h2><p className="mt-1 text-sm text-kv-muted">Сначала создаётся EIP-712 challenge. Safe должен подтвердить его контрактной подписью EIP-1271. Для ACTIVE требуются минимум два owner и threshold 2.</p><form action={issueWalletChallenge} className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]"><input type="hidden" name="chainId" value={data.chain.chainId}/><select name="organizationId" required className="min-h-11 rounded border border-kv-line px-3">{data.organizations.map(item => <option key={item.id} value={item.id}>{item.legalName}</option>)}</select><input name="walletAddress" required placeholder="0x Corporate Safe address" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><button className="rounded bg-kv-navy px-4 py-2 font-black text-white">Создать challenge</button></form></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Создать Registry/Admin Safe владельца платформы</h2><p className="mt-1 text-sm text-kv-muted">Укажите минимум два принадлежащих вам адреса. Порог фиксирован: 2 подписи. Развёртывание оплачивается BNB из подключённого кошелька; ключи остаются только в кошельках владельцев.</p><SafeDeploymentPanel chainId={data.chain.chainId} writesAllowed={data.chain.writesAllowed}/></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Развернуть BEP‑721 контракт реестра</h2><p className="mt-1 text-sm text-kv-muted">Вставьте созданный Registry/Admin Safe. MetaMask развернёт контракт в выбранной выше сети и вернёт данные для формы активации. Все роли контракта сразу принадлежат Safe.</p><RegistryContractDeploymentPanel chainId={data.chain.chainId} writesAllowed={data.chain.writesAllowed} bytecode={registryArtifact.bytecode} abiJson={JSON.stringify(registryArtifact.abi)}/></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Активировать развёрнутый Web3-реестр</h2><p className="mt-1 text-sm text-kv-muted">Платформа проверит транзакцию развёртывания, байткод, BEP‑721 интерфейс, все роли Registry/Admin Safe и порог 2-of-N. Непроверенный адрес активировать нельзя.</p><form action={registerContract} className="mt-3 grid gap-2"><div className="grid gap-2 md:grid-cols-2"><input name="contractAddress" required placeholder="0x адрес контракта IREPN" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><input name="registryAdminSafeAddress" required placeholder="0x Registry/Admin Safe" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><input name="deploymentTxHash" required placeholder="0x deployment transaction hash" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><input name="abiHash" required placeholder="0x SHA-256 ABI hash" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><input name="version" required defaultValue="1.0.0" placeholder="1.0.0" className="min-h-11 rounded border border-kv-line px-3"/><input name="reason" required minLength={10} defaultValue="Первичное развёртывание Web3-реестра в dev" className="min-h-11 rounded border border-kv-line px-3"/></div><button className="justify-self-start rounded bg-kv-navy px-5 py-3 font-black text-white">Проверить и активировать контракт</button></form><div className="mt-4 grid gap-2">{data.contracts.length === 0 ? <p className="rounded bg-amber-50 p-3 text-sm font-bold text-amber-800">Активного контракта пока нет: выпуск токенов заблокирован.</p> : data.contracts.map(contract => <div key={contract.id} className="rounded bg-kv-bg p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{contract.version} · {contract.status}{contract.active ? " · ACTIVE" : ""}</b>{contract.explorerUrl ? <a href={contract.explorerUrl} target="_blank" rel="noreferrer" className="font-black text-kv-red">BscScan ↗</a> : null}</div><div className="mt-1 break-all font-mono text-xs">Contract: {contract.contractAddress}<br/>Registry Safe: {contract.registryAdminSafeAddress ?? "не зафиксирован"}<br/>Deploy tx: {contract.deploymentTxHash}<br/>Block: {contract.deploymentBlockNumber ?? "—"}</div></div>)}</div></section>

    <section className="mt-6 grid gap-4">{data.wallets.map(wallet => <article key={wallet.id} className="rounded-md border border-kv-line bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black text-kv-navy">{wallet.organization.legalName}</h2><div className="text-xs font-mono text-kv-muted">{wallet.walletAddress}</div></div><span className="rounded-full bg-kv-bg px-3 py-1 text-xs font-black">{wallet.status} · {wallet.threshold ?? "—"}/{wallet.ownerCount ?? "—"}</span></div>{wallet.challenge ? <div className="mt-3"><div className="text-xs font-black">Message hash: <span className="font-mono">{wallet.challenge.messageHash}</span></div><textarea readOnly value={JSON.stringify(wallet.challenge.typedData, null, 2)} className="mt-2 h-48 w-full rounded border border-kv-line bg-kv-bg p-3 font-mono text-xs"/><form action={verifyWallet} className="mt-2 flex flex-col gap-2 md:flex-row"><input type="hidden" name="walletId" value={wallet.id}/><input name="signature" required placeholder="0x EIP-1271 Safe signature" className="min-h-11 flex-1 rounded border border-kv-line px-3 font-mono"/><button className="rounded bg-kv-navy px-4 py-2 font-black text-white">Проверить Safe</button></form></div> : null}</article>)}</section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Поставить операцию токена в Safe-очередь</h2>{!data.readiness.readyForMint ? <p className="mt-2 rounded bg-amber-50 p-3 text-sm font-bold text-amber-800">Операция будет доступна после выполнения обязательных пунктов в чек-листе выше.</p> : null}<form action={queueTokenOperation} className="mt-3 grid gap-2"><div className="grid gap-2 md:grid-cols-2"><select name="identityProfileId" required disabled={!data.readiness.readyForMint} className="min-h-11 rounded border border-kv-line px-3 disabled:opacity-60">{data.eligibleProfiles.map(item => <option key={item.id} value={item.id}>{item.title} · {item.stableId} · {item.token?.status ?? "без токена"}</option>)}</select><select name="operationType" disabled={!data.readiness.readyForMint} className="min-h-11 rounded border border-kv-line px-3 disabled:opacity-60"><option value="MINT">MINT</option><option value="UPDATE_HASHES">UPDATE HASHES</option><option value="SUSPEND">SUSPEND</option><option value="UNSUSPEND">UNSUSPEND</option><option value="REVOKE">REVOKE</option><option value="REASSIGN">REASSIGN</option></select></div><input name="tokenUri" disabled={!data.readiness.readyForMint} placeholder="Privacy-safe metadata URI (для MINT)" className="min-h-11 rounded border border-kv-line px-3 disabled:opacity-60"/><input name="targetAddress" disabled={!data.readiness.readyForMint} placeholder="Новый Corporate Safe (только REASSIGN)" className="min-h-11 rounded border border-kv-line px-3 font-mono disabled:opacity-60"/><textarea name="reason" required minLength={10} disabled={!data.readiness.readyForMint} placeholder="Основание операции" className="min-h-24 rounded border border-kv-line p-3 disabled:opacity-60"/><button disabled={!data.readiness.readyForMint} className="justify-self-start rounded bg-kv-navy px-5 py-3 font-black text-white disabled:opacity-60">Создать Safe-операцию</button></form></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Очередь Registry/Admin Safe</h2><p className="mt-1 text-sm text-kv-muted">Каждая запись содержит точные поля Safe-транзакции. Её подписывают владельцы Registry/Admin Safe; API закрытые ключи не хранит.</p><div className="mt-3 grid gap-2">{data.operations.map(item => <div key={item.id} className="rounded bg-kv-bg p-3 text-sm"><b>{item.operationType}</b> · {item.identityProfile.stableId} · {item.status}<div className="text-xs text-kv-muted">{new Date(item.createdAt).toISOString()} · Safe tx {item.registrySafeTxHash ?? "ожидается"} · chain tx {item.chainTxHash ?? "ожидается"}</div>{item.status === "PENDING_REGISTRY_SAFE" && !item.registrySafeTxHash ? <SafeOperationButton operationId={item.id} chainId={data.chain.chainId} writesAllowed={data.chain.writesAllowed} payload={item.payloadJson} proposeAction={proposeSafeTransaction}/> : null}{item.registrySafeTxHash && !item.chainTxHash ? <SafeExecutionButton operationId={item.id} chainId={data.chain.chainId} writesAllowed={data.chain.writesAllowed} payload={item.payloadJson} safeTxHash={item.registrySafeTxHash} getExecutionAction={getSafeExecution} recordExecutionAction={recordSafeExecution}/> : null}{item.payloadJson ? <details className="mt-2"><summary className="cursor-pointer font-black">Показать данные транзакции для Safe</summary><textarea readOnly value={JSON.stringify(item.payloadJson, null, 2)} className="mt-2 h-52 w-full rounded border border-kv-line bg-white p-3 font-mono text-xs"/></details> : null}{["PENDING_REGISTRY_SAFE", "READY_TO_EXECUTE", "SUBMITTED"].includes(item.status) ? <form action={recordChainTransaction} className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="operationId" value={item.id}/><input name="registrySafeTxHash" placeholder="Safe tx hash" className="min-h-10 rounded border border-kv-line bg-white px-3 font-mono"/><input name="chainTxHash" required placeholder="0x chain transaction hash" className="min-h-10 rounded border border-kv-line bg-white px-3 font-mono"/><button className="rounded bg-kv-navy px-3 py-2 font-black text-white">Записать tx</button></form> : null}</div>)}</div></section>
    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Reconciliation</h2><div className="mt-3 grid gap-2">{data.tokens.map(item => <div key={item.id} className="rounded bg-kv-bg p-3 text-sm"><b>{item.identityProfile.stableId}</b> · token {item.tokenId} · {item.status}<div className="text-xs text-kv-muted">{item.ownerWallet.organization.legalName} · {item.ownerAddress} · {item.reconciliationStatus}</div><form action={reconcileToken} className="mt-2"><input type="hidden" name="tokenId" value={item.id}/><button className="rounded border border-kv-line bg-white px-3 py-2 font-black">Сверить с блокчейном</button></form></div>)}{data.issues.map(item => <div key={item.id} className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><b>{item.issueType}</b> · {item.status} · {item.publicStatus}</div>)}</div></section>
  </div></main>;
}
