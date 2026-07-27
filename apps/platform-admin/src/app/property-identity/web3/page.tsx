import Link from "next/link";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "../../../lib/auth";
import { fetchSecureActorBackendJson, writeSecureActorBackendJson } from "../../../lib/server-api";
import registryArtifact from "../../../../../../packages/contracts/artifacts/contracts/Bep721PropertyIdentityToken.sol/Bep721PropertyIdentityToken.json";

export const dynamic = "force-dynamic";

const approvedAbiHash = `0x${createHash("sha256").update(JSON.stringify(registryArtifact.abi), "utf8").digest("hex")}`;

type Web3Response = {
  chain: { chainId: number; name: string; explorerUrl: string; production: boolean; writesAllowed: boolean };
  readiness: { mainnetSelected: boolean; writesAllowed: boolean; activePlatformWallet: boolean; platformRegistryWalletAddress: string | null; activeRegistryContract: boolean; registryContractAddress: string | null; activeCorporateWalletCount: number; eligibleProfileCount: number; reconciledActiveTokenCount: number; readyForMint: boolean; firstTokenLive: boolean; nextAction: string };
  platformWallets: Array<{ id: string; chainId: number; walletAddress: string; secretResourceName: string; status: string; verifiedAt: string | null }>;
  contracts: Array<{ id: string; chainId: number; contractAddress: string; platformRegistryWalletId: string | null; version: string; abiHash: string; bytecodeHash: string | null; deploymentTxHash: string; deploymentBlockNumber: string | null; verifiedAt: string | null; status: string; active: boolean; explorerUrl: string | null }>;
  wallets: Array<{ id: string; organizationId: string; walletAddress: string; chainId: number; status: string; organization: { legalName: string } }>;
  eligibleProfiles: Array<{ id: string; stableId: string; title: string; token: null | { id: string; status: string } }>;
  tokens: Array<{ id: string; tokenId: string; status: string; reconciliationStatus: string; contractAddress: string; ownerAddress: string; identityProfile: { stableId: string } }>;
  operations: Array<{ id: string; operationType: string; status: string; chainTxHash: string | null; payloadJson: unknown; createdAt: string; identityProfile: { stableId: string } }>;
  issues: Array<{ id: string; issueType: string; status: string; publicStatus: string; detectedAt: string }>;
};

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

async function bindPlatformWallet(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/platform-wallet", "POST", {
    walletAddress: value(formData, "walletAddress"),
    secretResourceName: value(formData, "secretResourceName"),
  }, { "Idempotency-Key": `platform-wallet:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function registerContract(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/contracts/register", "POST", {
    contractAddress: value(formData, "contractAddress"),
    deploymentTxHash: value(formData, "deploymentTxHash"),
    abiHash: value(formData, "abiHash"),
    version: value(formData, "version"),
    reason: value(formData, "reason"),
  }, { "Idempotency-Key": `contract-register:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function deployApprovedContract(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/contracts/deploy", "POST", {
    bytecode: registryArtifact.bytecode,
    abiHash: approvedAbiHash,
    version: value(formData, "version"),
    reason: value(formData, "reason"),
  }, { "Idempotency-Key": `contract-deploy:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function queueTokenOperation(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, "/api/v1/platform/property-identity/web3/token-operations", "POST", {
    identityProfileId: value(formData, "identityProfileId"),
    operationType: value(formData, "operationType"),
    reason: value(formData, "reason"),
    tokenUri: value(formData, "tokenUri"),
  }, { "Idempotency-Key": `token-operation:${crypto.randomUUID()}` });
  revalidatePath("/property-identity/web3");
}

async function executeOperation(formData: FormData) {
  "use server";
  await requirePlatformOwner();
  const operationId = value(formData, "operationId");
  await writeSecureActorBackendJson(process.env.PLATFORM_API_BASE_URL, `/api/v1/platform/property-identity/web3/token-operations/${encodeURIComponent(operationId)}/execute-platform-signer`, "POST", {}, { "Idempotency-Key": `platform-execute:${crypto.randomUUID()}` });
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
  const activeWallet = data.platformWallets.find((item) => item.chainId === data.chain.chainId && item.status === "ACTIVE");

  return <main className="min-h-screen bg-kv-bg p-6 text-kv-ink"><div className="mx-auto max-w-[1280px]">
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="text-xs font-black uppercase tracking-[.18em] text-kv-red">Только владелец платформы</div><h1 className="mt-2 text-3xl font-black text-kv-navy">Web3-реестр и BEP-721</h1><p className="mt-2 max-w-3xl text-sm text-kv-muted">Один контракт и один административный кошелёк владельца платформы. Закрытый ключ читается сервером только из Google Secret Manager. Кошельки агентств подтверждают представление объектов, но токенами не владеют.</p>{data.chain.production ? <p className={`mt-3 rounded p-3 text-sm font-black ${data.chain.writesAllowed ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{data.chain.writesAllowed ? "ВНИМАНИЕ: запись в BSC Mainnet разрешена." : "BSC Mainnet выбран, запись заблокирована до успешного dev E2E."}</p> : <p className="mt-3 rounded bg-blue-50 p-3 text-sm font-black text-blue-800">Тестовая сеть: {data.chain.name} · chain {data.chain.chainId}</p>}</div><Link href="/property-identity" className="rounded-full border border-kv-line bg-white px-4 py-2 font-black">К мониторингу</Link></header>

    <section className={`mt-6 rounded-md border p-5 ${data.readiness.firstTokenLive ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}><h2 className="text-xl font-black text-kv-navy">{data.readiness.firstTokenLive ? "Реестр подтверждён on-chain" : "Реестр ещё не прошёл полный E2E"}</h2><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{[
      ["Кошелёк платформы", data.readiness.activePlatformWallet, data.readiness.platformRegistryWalletAddress ?? "не привязан"],
      ["Контракт", data.readiness.activeRegistryContract, data.readiness.registryContractAddress ?? "не зарегистрирован"],
      ["Кошельки агентств", data.readiness.activeCorporateWalletCount > 0, `${data.readiness.activeCorporateWalletCount} активных`],
      ["Токены IN_SYNC", data.readiness.firstTokenLive, String(data.readiness.reconciledActiveTokenCount)],
    ].map(([label, ok, note]) => <div key={String(label)} className="rounded bg-white p-3 text-sm"><b className={ok ? "text-green-700" : "text-amber-700"}>{ok ? "✓" : "!"} {label}</b><div className="mt-1 break-all text-xs text-kv-muted">{note}</div></div>)}</div><p className="mt-3 text-sm font-bold">Следующее действие: {data.readiness.nextAction}</p></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Административный кошелёк платформы</h2><p className="mt-1 text-sm text-kv-muted">Аккаунт владельца: office@integrayachtsuae.com. Вводится только публичный адрес и полное имя версии секрета; приватный ключ в форму не вводится и в БД не сохраняется.</p>{activeWallet ? <div className="mt-3 rounded bg-green-50 p-3 text-sm"><b>ACTIVE</b><div className="mt-1 break-all font-mono text-xs">{activeWallet.walletAddress}<br/>{activeWallet.secretResourceName}</div></div> : <form action={bindPlatformWallet} className="mt-3 grid gap-2"><input name="walletAddress" required placeholder="0x публичный адрес кошелька" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><input name="secretResourceName" required placeholder="projects/kvartal-dev/secrets/.../versions/1" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><button className="justify-self-start rounded bg-kv-navy px-5 py-3 font-black text-white">Проверить Secret Manager и привязать</button></form>}</section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Контракт BEP-721</h2><p className="mt-1 text-sm text-kv-muted">Развёртывание выполняет API тем же кошельком платформы. До записи проверяются хэши утверждённого артефакта, после записи — deployment-транзакция, runtime bytecode и все роли.</p>{data.contracts.length ? <div className="mt-3 grid gap-2">{data.contracts.map((contract) => <div key={contract.id} className="rounded bg-kv-bg p-3 text-sm"><b>{contract.version} · {contract.status}{contract.active ? " · ACTIVE" : ""}</b><div className="mt-1 break-all font-mono text-xs">{contract.contractAddress}<br/>deploy: {contract.deploymentTxHash}<br/>bytecode: {contract.bytecodeHash ?? "—"}</div>{contract.explorerUrl ? <a className="mt-2 inline-block font-black text-kv-red" href={contract.explorerUrl} target="_blank" rel="noreferrer">BscScan ↗</a> : null}</div>)}</div> : <div className="mt-3 grid gap-3"><form action={deployApprovedContract} className="grid gap-2 rounded border border-kv-line bg-kv-bg p-3"><input name="version" required defaultValue="1.0.0" className="min-h-11 rounded border border-kv-line px-3"/><input name="reason" required minLength={10} defaultValue="Развёртывание утверждённого контракта Property Identity" className="min-h-11 rounded border border-kv-line px-3"/><div className="break-all font-mono text-xs text-kv-muted">ABI hash: {approvedAbiHash}</div><button disabled={!activeWallet || !data.chain.writesAllowed} className="justify-self-start rounded bg-kv-red px-5 py-3 font-black text-white disabled:opacity-50">Развернуть утверждённый контракт</button></form><details className="rounded border border-kv-line p-3"><summary className="cursor-pointer font-black text-kv-muted">Восстановить регистрацию уже развёрнутого контракта</summary><form action={registerContract} className="mt-3 grid gap-2"><input name="contractAddress" required placeholder="0x адрес развёрнутого контракта" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><input name="deploymentTxHash" required placeholder="0x deployment transaction hash" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><input name="abiHash" required defaultValue={approvedAbiHash} className="min-h-11 rounded border border-kv-line px-3 font-mono"/><input name="version" required defaultValue="1.0.0" className="min-h-11 rounded border border-kv-line px-3"/><input name="reason" required minLength={10} defaultValue="Восстановление регистрации контракта Property Identity" className="min-h-11 rounded border border-kv-line px-3"/><button disabled={!activeWallet || !data.chain.writesAllowed} className="justify-self-start rounded bg-kv-navy px-5 py-3 font-black text-white disabled:opacity-50">Проверить и зарегистрировать</button></form></details></div>}</section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Корпоративные кошельки агентств</h2><p className="mt-1 text-sm text-kv-muted">Только мониторинг. Агентство подключает свой кошелёк в собственном кабинете.</p><div className="mt-3 grid gap-2">{data.wallets.map((wallet) => <div key={wallet.id} className="rounded bg-kv-bg p-3 text-sm"><b>{wallet.organization.legalName} · {wallet.status}</b><div className="break-all font-mono text-xs text-kv-muted">{wallet.walletAddress}</div></div>)}</div></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Операции токенов</h2><form action={queueTokenOperation} className="mt-3 grid gap-2"><select name="identityProfileId" required disabled={!data.readiness.readyForMint} className="min-h-11 rounded border border-kv-line px-3 disabled:opacity-50">{data.eligibleProfiles.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.stableId} · {item.token?.status ?? "без токена"}</option>)}</select><select name="operationType" disabled={!data.readiness.readyForMint} className="min-h-11 rounded border border-kv-line px-3 disabled:opacity-50"><option value="MINT">MINT</option><option value="UPDATE_HASHES">UPDATE_HASHES</option><option value="SUSPEND">SUSPEND</option><option value="UNSUSPEND">UNSUSPEND</option><option value="REVOKE">REVOKE</option></select><input name="tokenUri" placeholder="Privacy-safe metadata URI (для MINT)" className="min-h-11 rounded border border-kv-line px-3"/><textarea name="reason" required minLength={10} placeholder="Основание операции" className="min-h-24 rounded border border-kv-line p-3"/><button disabled={!data.readiness.readyForMint} className="justify-self-start rounded bg-kv-navy px-5 py-3 font-black text-white disabled:opacity-50">Поставить операцию в очередь</button></form><div className="mt-5 grid gap-2">{data.operations.map((operation) => <div key={operation.id} className="rounded bg-kv-bg p-3 text-sm"><b>{operation.operationType} · {operation.identityProfile.stableId} · {operation.status}</b><div className="mt-1 break-all text-xs text-kv-muted">chain tx: {operation.chainTxHash ?? "ожидается"}</div>{["PENDING_PLATFORM_SIGNER", "FAILED_RETRYABLE"].includes(operation.status) ? <form action={executeOperation} className="mt-2"><input type="hidden" name="operationId" value={operation.id}/><button disabled={!data.chain.writesAllowed} className="rounded bg-kv-red px-4 py-2 font-black text-white disabled:opacity-50">Подписать ключом из Secret Manager и отправить</button></form> : null}</div>)}</div></section>

    <section className="mt-6 rounded-md border border-kv-line bg-white p-4"><h2 className="font-black text-kv-navy">Токены и сверка</h2><div className="mt-3 grid gap-2">{data.tokens.map((token) => <div key={token.id} className="rounded bg-kv-bg p-3 text-sm"><b>#{String(token.tokenId)} · {token.identityProfile.stableId} · {token.status}</b><div className="text-xs text-kv-muted">{token.reconciliationStatus} · owner/custody {token.ownerAddress}</div><form action={reconcileToken} className="mt-2"><input type="hidden" name="tokenId" value={token.id}/><button className="rounded border border-kv-line bg-white px-3 py-2 font-black">Сверить с блокчейном</button></form></div>)}</div></section>
    {data.issues.length ? <section className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"><h2 className="font-black text-red-800">Открытые расхождения</h2><div className="mt-3 grid gap-2">{data.issues.map((issue) => <div key={issue.id} className="rounded bg-white p-3 text-sm"><b>{issue.issueType}</b> · {issue.status} · {issue.publicStatus}</div>)}</div></section> : null}
  </div></main>;
}
