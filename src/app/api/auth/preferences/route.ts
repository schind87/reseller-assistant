import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  getProfileById,
  updateListingPreferences,
} from "@/lib/auth/otp";
import {
  composeSmokePetNotes,
  defaultListingPreferences,
  listingPreferencesSchema,
} from "@/lib/seller-preferences";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const profile = await getProfileById(auth.user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const preferences =
      profile.listing_preferences ?? defaultListingPreferences();

    return NextResponse.json({
      preferences,
      completed: Boolean(profile.listing_prefs_completed_at),
      completedAt: profile.listing_prefs_completed_at,
      smokePetNotes: composeSmokePetNotes(preferences),
    });
  } catch (err) {
    console.error("get preferences error:", err);
    return NextResponse.json(
      { error: "Could not load preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const json = await request.json();
    const parsed = listingPreferencesSchema.safeParse(json?.preferences ?? json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please answer all of the seller questions." },
        { status: 400 }
      );
    }

    const profile = await updateListingPreferences(auth.user.id, parsed.data);
    return NextResponse.json({
      preferences: profile.listing_preferences,
      completed: true,
      completedAt: profile.listing_prefs_completed_at,
      smokePetNotes: composeSmokePetNotes(profile.listing_preferences),
    });
  } catch (err) {
    console.error("put preferences error:", err);
    return NextResponse.json(
      { error: "Could not save preferences" },
      { status: 500 }
    );
  }
}
