"use client";

import Safe, { hashSafeMessage, type Eip1193Provider } from "@safe-global/protocol-kit";
import { useState } from "react";

type ProposalAction = (operationId: string, submission: {
  safeTransactionData: Record<string, unknown>;
  safeTxHash: string;
  senderAddress: string;
  senderSignature: string;
}) => Promise<{ ok: boolean; safeTxHash: string; requiredConfirmations: number }>;

type RegistryActivationAction = (submission: {
  contractAddress: string;
  registryAdminSafeAddress: string;
  deploymentTxHash: string;
  abiHash: string;
  version: string;
  reason: string;
}) => Promise<{ ok: boolean; contractAddress: string }>;

type CorporateSafeSignatureAction = (walletId: string, submission: {
  safeMessageHash: string;
  senderAddress: string;
  senderSignature: string;
}) => Promise<{ ok: boolean; status: string; confirmations: number; confirmationsRequired: number; productionReady?: boolean }>;

type SafePayload = {
  registryAdminSafeAddress: string;
  contractAddress: string;
  encodedCall: string;
};

declare global {
  interface Window { ethereum?: Eip1193Provider }
}

function readPayload(payload: unknown): SafePayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("В операции отсутствуют данные Safe.");
  const value = payload as Record<string, unknown>;
  const registryAdminSafeAddress = typeof value.registryAdminSafeAddress === "string" ? value.registryAdminSafeAddress : "";
  const contractAddress = typeof value.contractAddress === "string" ? value.contractAddress : "";
  const encodedCall = typeof value.encodedCall === "string" ? value.encodedCall : "";
  if (!registryAdminSafeAddress || !contractAddress || !encodedCall.startsWith("0x")) throw new Error("Данные Safe-транзакции неполные.");
  return { registryAdminSafeAddress, contractAddress, encodedCall };
}

async function ensureWalletChain(provider: Eip1193Provider, chainId: number) {
  const expectedChainHex = `0x${chainId.toString(16)}`;
  const currentChain = await provider.request({ method: "eth_chainId" });
  if (currentChain === expectedChainHex) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: expectedChainHex }] });
  } catch {
    const mainnet = chainId === 56;
    await provider.request({ method: "wallet_addEthereumChain", params: [{
      chainId: expectedChainHex,
      chainName: mainnet ? "BNB Smart Chain Mainnet" : "BNB Smart Chain Testnet",
      nativeCurrency: { name: mainnet ? "BNB" : "Test BNB", symbol: mainnet ? "BNB" : "tBNB", decimals: 18 },
      rpcUrls: [mainnet ? "https://bsc-dataseed.bnbchain.org" : "https://bsc-testnet-dataseed.bnbchain.org"],
      blockExplorerUrls: [mainnet ? "https://bscscan.com" : "https://testnet.bscscan.com"],
    }] });
  }
}

async function waitForSuccessfulReceipt(provider: Eip1193Provider, transactionHash: string, label: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await provider.request({ method: "eth_getTransactionReceipt", params: [transactionHash] });
    if (result && typeof result === "object" && !Array.isArray(result)) {
      const receipt = result as Record<string, unknown>;
      if (receipt.status !== "0x1") throw new Error(`${label} завершилась ошибкой. Tx: ${transactionHash}`);
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`${label} ещё подтверждается. Tx: ${transactionHash}`);
}

export function RegistryBootstrapPanel(props: {
  chainId: number;
  writesAllowed: boolean;
  bytecode: string;
  abiJson: string;
  activateAction: RegistryActivationAction;
}) {
  const [ownersText, setOwnersText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingContract, setPendingContract] = useState<null | {
    contractAddress: string;
    registryAdminSafeAddress: string;
    deploymentTxHash: string;
    abiHash: string;
  }>(null);

  async function bootstrap() {
    setBusy(true);
    setMessage(null);
    try {
      if (!props.writesAllowed) throw new Error("Запись в BNB Smart Chain Mainnet административно заблокирована.");
      if (pendingContract) {
        setMessage("Повторно проверяем и активируем уже развёрнутый контракт…");
        await props.activateAction({ ...pendingContract, version: "1.0.0", reason: "Первичное развёртывание Property Identity Registry в BNB Mainnet" });
        setMessage(`Готово. Web3-реестр активирован: ${pendingContract.contractAddress}`);
        return;
      }

      const provider = window.ethereum;
      if (!provider) throw new Error("Установите MetaMask или другой EIP-1193 кошелёк.");
      await ensureWalletChain(provider, props.chainId);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const sender = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0].toLowerCase() : "";
      const owners = [...new Set(ownersText.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
      if (owners.length < 2 || owners.some((item) => !/^0x[0-9a-f]{40}$/.test(item))) throw new Error("Укажите минимум два разных корректных публичных адреса владельцев Safe.");
      if (!owners.includes(sender)) throw new Error("Подключённый кошелёк должен быть одним из владельцев Safe.");
      if (!props.bytecode.startsWith("0x") || props.bytecode.length < 100) throw new Error("Deployment bytecode контракта отсутствует.");

      setMessage("Шаг 1 из 3: создаём Registry/Admin Safe 2-of-N…");
      const protocolKit = await Safe.init({ provider, signer: sender, predictedSafe: { safeAccountConfig: { owners, threshold: 2 }, safeDeploymentConfig: { safeVersion: "1.4.1" } } });
      const safeAddress = await protocolKit.getAddress();
      if (!(await protocolKit.isSafeDeployed())) {
        const deployment = await protocolKit.createSafeDeploymentTransaction();
        const safeTxHash = await provider.request({ method: "eth_sendTransaction", params: [{ from: sender, to: deployment.to, value: deployment.value, data: deployment.data }] });
        if (typeof safeTxHash !== "string") throw new Error("Кошелёк не вернул hash транзакции развёртывания Safe.");
        setMessage(`Шаг 1 из 3: ожидаем Safe ${safeAddress}. Tx: ${safeTxHash}`);
        await waitForSuccessfulReceipt(provider, safeTxHash, "Развёртывание Safe");
      }

      setMessage(`Шаг 2 из 3: Safe ${safeAddress} готов. Подтвердите развёртывание контракта.`);
      const constructorArgument = safeAddress.toLowerCase().slice(2).padStart(64, "0");
      const deploymentTxHash = await provider.request({ method: "eth_sendTransaction", params: [{ from: sender, data: `${props.bytecode}${constructorArgument}` }] });
      if (typeof deploymentTxHash !== "string") throw new Error("Кошелёк не вернул deployment tx hash контракта.");
      const receipt = await waitForSuccessfulReceipt(provider, deploymentTxHash, "Развёртывание контракта");
      if (typeof receipt.contractAddress !== "string") throw new Error(`Сеть не вернула адрес контракта. Tx: ${deploymentTxHash}`);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(props.abiJson));
      const abiHash = `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      const deploymentResult = { contractAddress: receipt.contractAddress, registryAdminSafeAddress: safeAddress, deploymentTxHash, abiHash };
      setPendingContract(deploymentResult);

      setMessage("Шаг 3 из 3: API проверяет байткод, BEP-721, роли, Safe и deployment receipt…");
      await props.activateAction({ ...deploymentResult, version: "1.0.0", reason: "Первичное развёртывание Property Identity Registry в BNB Mainnet" });
      setMessage(`Готово. Registry/Admin Safe: ${safeAddress}. Web3-контракт активирован: ${receipt.contractAddress}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось ввести Web3-реестр в работу.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 grid gap-3"><textarea value={ownersText} onChange={(event) => setOwnersText(event.target.value)} disabled={busy || Boolean(pendingContract)} placeholder={"0x публичный адрес владельца 1\n0x публичный адрес владельца 2"} className="min-h-24 rounded border border-kv-line p-3 font-mono text-sm disabled:opacity-60"/><button type="button" disabled={busy || !props.writesAllowed} onClick={bootstrap} className="justify-self-start rounded bg-kv-red px-5 py-3 font-black text-white disabled:opacity-60">{busy ? "Выполняется… откройте MetaMask" : pendingContract ? "Повторить проверку и активацию" : "Создать Safe и запустить Web3-реестр"}</button>{message ? <pre className="whitespace-pre-wrap break-all rounded bg-kv-bg p-3 text-sm">{message}</pre> : null}<p className="text-xs text-kv-muted">Будут запрошены две Mainnet-транзакции: создание Safe и развёртывание контракта. Приложение не получает private keys и не может подтвердить транзакцию вместо владельца.</p></div>;
}

export function CorporateSafeChallengePanel(props: {
  walletId: string;
  safeAddress: string;
  chainId: number;
  typedData: unknown;
  submitAction: CorporateSafeSignatureAction;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signAndSubmit() {
    setBusy(true);
    setMessage(null);
    try {
      const provider = window.ethereum;
      if (!provider) throw new Error("Установите MetaMask или другой EIP-1193 кошелёк.");
      await ensureWalletChain(provider, props.chainId);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const sender = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      if (!sender) throw new Error("Кошелёк не вернул адрес владельца Safe.");
      const protocolKit = await Safe.init({ provider, signer: sender, safeAddress: props.safeAddress });
      const owners = await protocolKit.getOwners();
      if (!owners.some((owner) => owner.toLowerCase() === sender.toLowerCase())) throw new Error("Подключённый адрес не является владельцем этого Corporate Safe.");
      const safeMessage = protocolKit.createMessage(props.typedData as never);
      const signedMessage = await protocolKit.signMessage(safeMessage, "eth_signTypedData_v4", props.safeAddress);
      const ownerSignature = signedMessage.getSignature(sender);
      if (!ownerSignature?.data) throw new Error("Кошелёк не вернул подпись Safe message.");
      const safeMessageHash = await protocolKit.getSafeMessageHash(hashSafeMessage(props.typedData as never));
      const result = await props.submitAction(props.walletId, { safeMessageHash, senderAddress: sender, senderSignature: ownerSignature.data });
      setMessage(result.productionReady ? "Corporate Safe подтверждён порогом владельцев и активирован." : `Подпись принята: ${result.confirmations}/${result.confirmationsRequired}. Переключите MetaMask на второго владельца и нажмите кнопку ещё раз.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подписать challenge Corporate Safe.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3"><button type="button" disabled={busy} onClick={signAndSubmit} className="rounded bg-kv-red px-4 py-2 font-black text-white disabled:opacity-60">{busy ? "Откройте MetaMask…" : "Подписать challenge владельцем Safe"}</button>{message ? <p className="mt-2 break-all rounded bg-kv-bg p-3 text-sm">{message}</p> : null}<p className="mt-2 text-xs text-kv-muted">Для Safe 2-of-N нажмите кнопку по одному разу из каждого из двух адресов владельцев. Подписи координируются через Safe Transaction Service; gas не расходуется.</p></div>;
}

export function SafeDeploymentPanel(props: { chainId: number; writesAllowed: boolean }) {
  const [ownersText, setOwnersText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function deploy() {
    setBusy(true);
    setMessage(null);
    try {
      if (!props.writesAllowed) throw new Error("Запись в выбранную сеть административно заблокирована.");
      const provider = window.ethereum;
      if (!provider) throw new Error("Установите MetaMask или другой EIP-1193 кошелёк.");
      await ensureWalletChain(provider, props.chainId);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const sender = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      const owners = [...new Set(ownersText.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean).map((item) => item.toLowerCase()))];
      if (owners.length < 2 || owners.some((item) => !/^0x[0-9a-f]{40}$/.test(item))) throw new Error("Укажите минимум два разных корректных адреса владельцев Safe.");
      if (!owners.includes(sender.toLowerCase())) throw new Error("Подключённый кошелёк должен быть одним из владельцев Safe.");
      const protocolKit = await Safe.init({ provider, signer: sender, predictedSafe: { safeAccountConfig: { owners, threshold: 2 }, safeDeploymentConfig: { safeVersion: "1.4.1" } } });
      const safeAddress = await protocolKit.getAddress();
      if (await protocolKit.isSafeDeployed()) {
        setMessage(`Safe уже развёрнут: ${safeAddress}`);
        return;
      }
      const deployment = await protocolKit.createSafeDeploymentTransaction();
      const transactionHash = await provider.request({ method: "eth_sendTransaction", params: [{ from: sender, to: deployment.to, value: deployment.value, data: deployment.data }] });
      if (typeof transactionHash !== "string") throw new Error("Кошелёк не вернул hash транзакции развёртывания.");
      setMessage(`Registry/Admin Safe: ${safeAddress}. Deployment tx: ${transactionHash}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось развернуть Safe.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 grid gap-2"><textarea value={ownersText} onChange={(event) => setOwnersText(event.target.value)} placeholder={"0x владелец 1\n0x владелец 2"} className="min-h-24 rounded border border-kv-line p-3 font-mono text-sm"/><button type="button" disabled={busy || !props.writesAllowed} onClick={deploy} className="justify-self-start rounded bg-kv-navy px-4 py-2 font-black text-white disabled:opacity-60">{busy ? "Откройте кошелёк…" : "Развернуть Registry/Admin Safe 2-of-N"}</button>{message ? <p className="break-all rounded bg-kv-bg p-3 text-xs">{message}</p> : null}</div>;
}

export function RegistryContractDeploymentPanel(props: { chainId: number; writesAllowed: boolean; bytecode: string; abiJson: string }) {
  const [safeAddress, setSafeAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function deploy() {
    setBusy(true);
    setMessage(null);
    try {
      if (!props.writesAllowed) throw new Error("Запись в выбранную сеть административно заблокирована.");
      const provider = window.ethereum;
      if (!provider) throw new Error("Установите MetaMask или другой EIP-1193 кошелёк.");
      const normalizedSafe = safeAddress.trim().toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(normalizedSafe)) throw new Error("Укажите корректный адрес Registry/Admin Safe.");
      if (!props.bytecode.startsWith("0x") || props.bytecode.length < 100) throw new Error("Deployment bytecode контракта отсутствует.");
      await ensureWalletChain(provider, props.chainId);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const sender = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      if (!sender) throw new Error("Кошелёк не вернул адрес deployer.");
      const constructorArgument = normalizedSafe.slice(2).padStart(64, "0");
      const transactionHash = await provider.request({ method: "eth_sendTransaction", params: [{ from: sender, data: `${props.bytecode}${constructorArgument}` }] });
      if (typeof transactionHash !== "string") throw new Error("Кошелёк не вернул deployment tx hash.");
      setMessage(`Транзакция ${transactionHash} отправлена. Ожидаем подтверждение сети…`);
      let receipt: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 45 && !receipt; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const result = await provider.request({ method: "eth_getTransactionReceipt", params: [transactionHash] });
        if (result && typeof result === "object" && !Array.isArray(result)) receipt = result as Record<string, unknown>;
      }
      if (!receipt) throw new Error(`Контракт ещё подтверждается. Deployment tx: ${transactionHash}`);
      if (receipt.status !== "0x1" || typeof receipt.contractAddress !== "string") throw new Error(`Deployment завершился ошибкой. Tx: ${transactionHash}`);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(props.abiJson));
      const abiHash = `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      setMessage(`Contract: ${receipt.contractAddress}\nDeployment tx: ${transactionHash}\nRegistry Safe: ${normalizedSafe}\nABI hash: ${abiHash}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось развернуть контракт.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 grid gap-2"><input value={safeAddress} onChange={(event) => setSafeAddress(event.target.value)} placeholder="0x Registry/Admin Safe" className="min-h-11 rounded border border-kv-line px-3 font-mono"/><button type="button" disabled={busy || !props.writesAllowed} onClick={deploy} className="justify-self-start rounded bg-kv-red px-4 py-2 font-black text-white disabled:opacity-60">{busy ? "Ожидаем подтверждение сети…" : "Развернуть контракт через кошелёк"}</button>{message ? <pre className="whitespace-pre-wrap break-all rounded bg-kv-bg p-3 text-xs">{message}</pre> : null}</div>;
}

export function SafeOperationButton(props: { operationId: string; chainId: number; writesAllowed: boolean; payload: unknown; proposeAction: ProposalAction }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function propose() {
    setBusy(true);
    setMessage(null);
    try {
      if (!props.writesAllowed) throw new Error("Запись в выбранную сеть административно заблокирована.");
      const provider = window.ethereum;
      if (!provider) throw new Error("Установите MetaMask или другой EIP-1193 кошелёк.");
      await ensureWalletChain(provider, props.chainId);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const senderAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      if (!senderAddress) throw new Error("Кошелёк не вернул адрес подписанта.");
      const transaction = readPayload(props.payload);
      const protocolKit = await Safe.init({ provider, signer: senderAddress, safeAddress: transaction.registryAdminSafeAddress });
      const safeTransaction = await protocolKit.createTransaction({ transactions: [{ to: transaction.contractAddress, value: "0", data: transaction.encodedCall }] });
      const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
      const signature = await protocolKit.signHash(safeTxHash);
      const result = await props.proposeAction(props.operationId, { safeTransactionData: { ...safeTransaction.data }, safeTxHash, senderAddress, senderSignature: signature.data });
      setMessage(`Предложение ${result.safeTxHash} отправлено. Требуется подписей: ${result.requiredConfirmations}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подписать Safe-транзакцию.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-2"><button type="button" disabled={busy || !props.writesAllowed} onClick={propose} className="rounded bg-kv-red px-4 py-2 font-black text-white disabled:opacity-60">{busy ? "Откройте кошелёк…" : "Подписать и отправить в Safe"}</button>{message ? <p className="mt-2 break-all rounded bg-white p-2 text-xs">{message}</p> : null}</div>;
}

export function SafeExecutionButton(props: {
  operationId: string;
  chainId: number;
  writesAllowed: boolean;
  payload: unknown;
  safeTxHash: string;
  getExecutionAction: (operationId: string) => Promise<{ status: string; confirmations: number; confirmationsRequired: number; chainTxHash: string | null; serviceTransaction: Record<string, unknown> }>;
  recordExecutionAction: (operationId: string, safeTxHash: string, chainTxHash: string) => Promise<{ ok: boolean }>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function execute() {
    setBusy(true);
    setMessage(null);
    try {
      if (!props.writesAllowed) throw new Error("Запись в выбранную сеть административно заблокирована.");
      const status = await props.getExecutionAction(props.operationId);
      if (status.chainTxHash) {
        await props.recordExecutionAction(props.operationId, props.safeTxHash, status.chainTxHash);
        setMessage(`Транзакция уже исполнена: ${status.chainTxHash}`);
        return;
      }
      if (status.status !== "READY_TO_EXECUTE") {
        setMessage(`Собрано подписей ${status.confirmations} из ${status.confirmationsRequired}. Второй владелец должен подтвердить транзакцию в Safe.`);
        return;
      }
      const provider = window.ethereum;
      if (!provider) throw new Error("Установите MetaMask или другой EIP-1193 кошелёк.");
      await ensureWalletChain(provider, props.chainId);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const senderAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      if (!senderAddress) throw new Error("Кошелёк не вернул адрес исполнителя.");
      const transaction = readPayload(props.payload);
      const protocolKit = await Safe.init({ provider, signer: senderAddress, safeAddress: transaction.registryAdminSafeAddress });
      const execution = await protocolKit.executeTransaction(status.serviceTransaction as Parameters<typeof protocolKit.executeTransaction>[0]);
      await props.recordExecutionAction(props.operationId, props.safeTxHash, execution.hash);
      setMessage(`Транзакция отправлена в блокчейн: ${execution.hash}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось исполнить Safe-транзакцию.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-2"><button type="button" disabled={busy || !props.writesAllowed} onClick={execute} className="rounded bg-kv-navy px-4 py-2 font-black text-white disabled:opacity-60">{busy ? "Проверяем Safe…" : "Проверить подписи и исполнить"}</button>{message ? <p className="mt-2 break-all rounded bg-white p-2 text-xs">{message}</p> : null}</div>;
}
