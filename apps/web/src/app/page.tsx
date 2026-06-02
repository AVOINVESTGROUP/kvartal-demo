import { HomeClient } from "@/components/HomeClient";
import { getMarketSnapshot, getObjectItems } from "@/components/Objects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [objects, marketSnapshot] = await Promise.all([getObjectItems(), getMarketSnapshot()]);
  const apiBaseUrl = process.env.PUBLIC_API_BASE_URL ?? "";

  return <HomeClient objects={objects} marketSnapshot={marketSnapshot} apiBaseUrl={apiBaseUrl} />;
}
