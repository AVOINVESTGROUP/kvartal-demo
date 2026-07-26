"use client";

import Safe, { type Eip1193Provider } from "@safe-global/protocol-kit";
import { useState } from "react";

type ProposalAction = (operationId: string, submission: {
  safeTransactionData: Record<string, unknown>;
  safeTxHash: string;
  senderAddress: string;
  senderSignature: string;
}) => Promise<{ ok: boolean; safeTxHash: string; requiredConfirmations: number }>;

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
