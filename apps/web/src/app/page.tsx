import { HomeClient } from "@/components/HomeClient";
import { getMarketSnapshot, getObjectItems } from "@/components/Objects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [objects, marketSnapshot] = await Promise.all([getObjectItems(), getMarketSnapshot()]);

  return <HomeClient objects={objects} marketSnapshot={marketSnapshot} />;
}
