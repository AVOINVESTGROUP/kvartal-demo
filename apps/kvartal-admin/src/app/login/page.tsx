import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function loginAction(formData: FormData) {
  "use server";

  const expected = process.env.KVARTAL_ADMIN_BASIC_AUTH;
  const sessionToken = process.env.KVARTAL_ADMIN_SESSION_TOKEN;
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!expected || !sessionToken || `${username}:${password}` !== expected) {
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set("kvartal_admin_session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/");
}

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  return (
    <main className="grid min-h-screen place-items-center bg-kv-bg px-5 text-kv-ink">
      <form action={loginAction} className="w-full max-w-[420px] rounded-md border border-kv-line bg-white p-6 shadow-sm">
        <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">KVARTAL admin</div>
        <h1 className="mt-2 text-2xl font-black text-kv-navy">Вход в админку</h1>
        <div className="mt-5 grid gap-3">
          <input name="username" autoComplete="username" placeholder="Логин" className="h-11 rounded-md border border-kv-line px-3" />
          <input name="password" type="password" autoComplete="current-password" placeholder="Пароль" className="h-11 rounded-md border border-kv-line px-3" />
          {searchParams?.error ? <p className="text-sm font-bold text-kv-red">Неверный логин или пароль.</p> : null}
          <button className="rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Войти</button>
        </div>
      </form>
    </main>
  );
}
