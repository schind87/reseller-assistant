import { redirect } from "next/navigation";
import { AppHome } from "@/components/AppHome";
import { getAuthUser } from "@/lib/api-auth";
import { getProfileById } from "@/lib/auth/otp";
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

  const profile = await getProfileById(user.id).catch(() => null);

  return (
    <AppHome
      initialListings={listings}
      preferencesCompleted={Boolean(profile?.listing_prefs_completed_at)}
      initialPreferences={profile?.listing_preferences ?? null}
      userEmail={user.email}
    />
  );
}
