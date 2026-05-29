import { getPlatformSession } from "../../lib/auth";

export default async function UnauthorizedPage() {
  const session = await getPlatformSession();

  return (
    <main className="grid min-h-screen place-items-center bg-kv-bg px-5 text-kv-ink">
      <section className="w-full max-w-[520px] rounded-md border border-kv-line bg-white p-6 shadow-sm">
        <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">Fixer.guru</div>
        <h1 className="mt-2 text-2xl font-black text-kv-navy">Нет доступа</h1>
        <p className="mt-3 text-[14px] leading-6 text-kv-muted">
          Google аккаунт {session?.email ?? ""} вошел успешно, но для него нет роли platform owner или platform admin.
        </p>
        <a href="/logout" className="mt-5 inline-flex rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Выйти</a>
      </section>
    </main>
  );
}
