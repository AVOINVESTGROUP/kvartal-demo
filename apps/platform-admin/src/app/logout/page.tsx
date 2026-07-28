"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function LogoutPage() {
  const started = useRef(false);
  const [state, setState] = useState<"working" | "failed">("working");
  const [message, setMessage] = useState("Завершаем текущую сессию…");

  const logout = useCallback(async () => {
    setState("working");
    setMessage("Завершаем текущую сессию…");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store", credentials: "same-origin" });
      if (!csrfResponse.ok) throw new Error(`Не удалось подготовить выход (${csrfResponse.status}).`);
      const csrf = await csrfResponse.json() as { csrfToken?: string };
      if (!csrf.csrfToken) throw new Error("Сервер не вернул защитный токен выхода.");
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrf.csrfToken },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string; correlationId?: string } } | null;
        throw new Error(payload?.error?.message ?? `Не удалось завершить сессию (${response.status}).`);
      }
      window.location.replace("/login?loggedOut=1");
    } catch (caught) {
      setState("failed");
      setMessage(caught instanceof Error ? caught.message : "Не удалось завершить сессию.");
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void logout();
  }, [logout]);

  return (
    <main className="grid min-h-screen place-items-center bg-kv-bg px-5 text-kv-ink">
      <section className="w-full max-w-[460px] rounded-md border border-kv-line bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-black text-kv-navy">{state === "working" ? "Выход из кабинета" : "Выход не завершён"}</h1>
        <p className="mt-3 text-sm leading-6 text-kv-muted">{message}</p>
        {state === "failed" ? (
          <button type="button" onClick={() => void logout()} className="mt-5 inline-flex w-full justify-center rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">
            Повторить выход
          </button>
        ) : (
          <div className="mx-auto mt-5 h-6 w-6 animate-spin rounded-full border-2 border-kv-line border-t-kv-navy" aria-label="Выход выполняется" />
        )}
      </section>
    </main>
  );
}
