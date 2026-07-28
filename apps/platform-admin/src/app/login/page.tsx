import LoginClient from "./LoginClient";
import { getPlatformSession } from "../../lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  if (await getPlatformSession()) redirect("/");
  const params = await searchParams;
  return <LoginClient error={params?.error} />;
}
