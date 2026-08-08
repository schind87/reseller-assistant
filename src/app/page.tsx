import { redirect } from "next/navigation";
import { getSessionFromCookies, isUnlocked } from "@/lib/session";

export default async function HomePage() {
  try {
    const session = await getSessionFromCookies();
    if (isUnlocked(session)) {
      redirect("/app");
    }
  } catch {
    // SESSION_SECRET missing in local setup — send to unlock
  }
  redirect("/unlock");
}
