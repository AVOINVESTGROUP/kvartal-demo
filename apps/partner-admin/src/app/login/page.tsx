import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; organization?: string }> }) {
  const params = await searchParams;
  return <LoginClient error={params?.error} organizationSlug={params?.organization} />;
}
