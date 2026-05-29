import { HomeClient } from "@/components/HomeClient";
import { getObjectItems } from "@/components/Objects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const objects = await getObjectItems();

  return <HomeClient objects={objects} />;
}
