import { redirect } from "next/navigation";
import { clearPlatformSession } from "../../lib/auth";

export async function GET() {
  await clearPlatformSession();
  redirect("/login");
}
