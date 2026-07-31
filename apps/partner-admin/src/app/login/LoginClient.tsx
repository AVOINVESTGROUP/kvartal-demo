"use client";

import { inMemoryPersistence, setPersistence, signInWithPopup, signOut, type UserCredential } from "firebase/auth";
import { useCallback, useState } from "react";
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from "../../lib/firebase-client";

export default function LoginClient({ error }: { error?: string }) {
  const configured = isFirebaseConfigured();
  const [busy, setBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const createServerSession = useCallback(async (credential: UserCredential) => {
    const csrf = await fetch("/api/auth/csrf", { cache: "no-store" }).then((response) => response.json()) as { csrfToken: string };
    const idToken = await credential.user.getIdToken();
    const response = await fetch("/api/auth/firebase/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.csrfToken },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string; correlationId?: string } } | null;
      const suffix = payload?.error?.correlationId ? ` ID: ${payload.error.correlationId}` : "";
      throw new Error(`${payload?.error?.message ?? "Вход не завершён."}${suffix}`);
    }
  }, []);

  async function signIn() {
    setBusy(true);
    setClientError(null);

    try {
      const auth = getFirebaseAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithPopup(auth, googleProvider);
      await createServerSession(credential);
      await signOut(auth);
      window.location.replace("/");
    } catch (caught) {
      setClientError(caught instanceof Error ? caught.message : "Вход не завершен.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-kv-bg px-5 text-kv-ink">
      <section className="w-full max-w-[460px] rounded-md border border-kv-line bg-white p-6 shadow-sm">
        <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">FIXER.GURU PARTNER ADMIN</div>
        <h1 className="mt-2 text-2xl font-black text-kv-navy">Вход в админку организации</h1>
        <p className="mt-3 text-[14px] leading-6 text-kv-muted">
          Вход только через Google аккаунт. Доступ получают собственники и администраторы организации, назначенные через
          Fixer.guru.
        </p>
        {error ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-bold text-kv-red">
            Вход не завершен. Попробуйте еще раз.
          </p>
        ) : null}
        {clientError ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-bold text-kv-red">{clientError}</p> : null}
        {!configured ? (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-700">
            Firebase Auth не настроен в окружении App Hosting.
          </p>
        ) : null}
        <button
          type="button"
          onClick={signIn}
          disabled={!configured || busy}
          className="mt-5 inline-flex w-full justify-center rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white disabled:pointer-events-none disabled:bg-kv-muted"
        >
          {busy ? "Проверяем доступ..." : "Войти через Google"}
        </button>
      </section>
    </main>
  );
}
