import { AppHome } from "@/components/AppHome";
import { getSessionFromCookies, isUnlocked } from "@/lib/session";
import { listListings } from "@/lib/supabase/queries";
import type { Listing } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function AppHomePage() {
  try {
    const session = await getSessionFromCookies();
    if (!isUnlocked(session)) {
      redirect("/unlock");
    }
  } catch {
    redirect("/unlock");
  }

  let listings: Listing[] = [];
  try {
    listings = await listListings();
  } catch (err) {
    console.error("listListings failed:", err);
  }

  return <AppHome initialListings={listings} />;
}
