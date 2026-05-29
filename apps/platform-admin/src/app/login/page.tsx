export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const configured = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);

  return (
    <main className="grid min-h-screen place-items-center bg-kv-bg px-5 text-kv-ink">
      <section className="w-full max-w-[460px] rounded-md border border-kv-line bg-white p-6 shadow-sm">
        <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">Fixer.guru</div>
        <h1 className="mt-2 text-2xl font-black text-kv-navy">Вход для собственника проекта</h1>
        <p className="mt-3 text-[14px] leading-6 text-kv-muted">
          Вход только через Google аккаунт. Права доступа проверяются по PostgreSQL: platform owner, команда Fixer.guru и собственники организаций.
        </p>
        {searchParams?.error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-bold text-kv-red">Google вход не завершен. Попробуйте еще раз.</p> : null}
        {!configured ? (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-700">
            Google OAuth client не настроен в окружении App Hosting.
          </p>
        ) : null}
        <a
          href="/api/auth/google/start"
          className={`mt-5 inline-flex w-full justify-center rounded-full px-5 py-3 text-sm font-black text-white ${configured ? "bg-kv-navy" : "pointer-events-none bg-kv-muted"}`}
        >
          Войти через Google
        </a>
      </section>
    </main>
  );
}
