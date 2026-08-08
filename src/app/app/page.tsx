import { redirect } from "next/navigation";
import { AppHome } from "@/components/AppHome";
import { getAuthUser } from "@/lib/api-auth";
import { listListings } from "@/lib/supabase/queries";
import type { Listing } from "@/lib/types";

export default async function AppHomePage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/unlock");
  }

  let listings: Listing[] = [];
  try {
    listings = await listListings(user.id);
  } catch (err) {
    console.error("listListings failed:", err);
  }

  return <AppHome initialListings={listings} />;
}
