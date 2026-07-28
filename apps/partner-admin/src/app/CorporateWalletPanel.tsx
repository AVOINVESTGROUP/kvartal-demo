"use client";

import { useEffect, useState } from "react";

type EthereumProvider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
type Wallet = { id: string; walletAddress: string; chainId: number; status: string; verifiedAt: string | null };

export function CorporateWalletPanel() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/v1/admin/corporate-wallets", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось загрузить корпоративные кошельки.");
    setWallets(payload.wallets ?? []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/v1/admin/corporate-wallets", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message ?? "Не удалось загрузить корпоративные кошельки.");
        if (active) setWallets(payload.wallets ?? []);
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Ошибка загрузки."); });
    return () => { active = false; };
  }, []);

  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
      if (!ethereum) throw new Error("Установите MetaMask или другой совместимый корпоративный кошелёк.");
      const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("Кошелёк не предоставил адрес.");
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
      const challengeResponse = await fetch("/api/v1/admin/corporate-wallets/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ walletAddress }) });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challenge?.error?.message ?? "Не удалось создать проверку кошелька.");
      const signature = await ethereum.request({ method: "eth_signTypedData_v4", params: [walletAddress, JSON.stringify(challenge.typedData)] }) as string;
      const verifyResponse = await fetch("/api/v1/admin/corporate-wallets/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ walletId: challenge.walletId, signature }) });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(verified?.error?.message ?? "Подпись кошелька не прошла проверку.");
      await load();
      setMessage("Корпоративный кошелёк подтверждён. Закрытый ключ остался только в вашем кошельке.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подключить кошелёк.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-6">
      <div className="rounded-md border border-kv-line bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-kv-navy">Корпоративный Web3-кошелёк агентства</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-5 text-kv-muted">Подтвердите кошелёк, на котором учитываются объекты и права представления агентства. Подпись подтверждает контроль адреса; платформа не получает закрытый ключ и не переводит средства.</p>
          </div>
          <button type="button" onClick={connect} disabled={busy} className="rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "Подтверждение в кошельке…" : "Подключить кошелёк"}</button>
        </div>
        {wallets.length ? <div className="mt-4 grid gap-2">{wallets.map((wallet) => <div key={wallet.id} className="flex flex-col gap-1 rounded border border-kv-line bg-kv-bg p-3 text-sm md:flex-row md:items-center md:justify-between"><span className="break-all font-mono">{wallet.walletAddress}</span><span className="font-black text-emerald-700">{wallet.status} · BSC {wallet.chainId}</span></div>)}</div> : <p className="mt-4 text-sm text-amber-700">Корпоративный кошелёк ещё не подключён. Без него нельзя подтвердить представительство и опубликовать объект в Web3-реестре.</p>}
        {message ? <p className="mt-3 rounded bg-kv-bg p-3 text-sm text-kv-navy">{message}</p> : null}
      </div>
    </section>
  );
}
