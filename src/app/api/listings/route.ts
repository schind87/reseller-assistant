import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { getProfileById } from "@/lib/auth/otp";
import { createListing, listListings } from "@/lib/supabase/queries";

const createSchema = z.object({
  platform: z.enum(["mercari", "poshmark"]),
});

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const listings = await listListings(auth.user.id);
    return NextResponse.json({ listings });
  } catch (err) {
    console.error("list listings error:", err);
    return NextResponse.json(
      { error: "Could not load listings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  try {
    const profile = await getProfileById(auth.user.id);
    if (!profile?.listing_prefs_completed_at) {
      return NextResponse.json(
        { error: "Finish your seller profile before starting a listing." },
        { status: 400 }
      );
    }

    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose Mercari or Poshmark" },
        { status: 400 }
      );
    }

    const listing = await createListing(parsed.data.platform, auth.user.id);
    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    console.error("create listing error:", err);
    return NextResponse.json(
      { error: "Could not create listing" },
      { status: 500 }
    );
  }
}
