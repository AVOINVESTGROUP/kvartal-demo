"use client";

import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin page error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-kv-bg px-5 text-kv-ink">
      <section className="w-full max-w-[560px] rounded-md border border-kv-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-kv-navy">Страница временно недоступна</h1>
        <p className="mt-3 text-sm leading-6 text-kv-muted">Сессия сохранена. Повторите запрос. Если ошибка останется, сообщите идентификатор ниже — по нему событие можно найти в журнале.</p>
        <p className="mt-4 rounded-md bg-kv-bg p-3 font-mono text-xs text-kv-muted">ID: {error.digest ?? "не назначен"}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Повторить</button>
          <a href="/logout" className="rounded-full border border-kv-line bg-white px-5 py-3 text-sm font-black text-kv-navy">Выйти</a>
        </div>
      </section>
    </main>
  );
}

