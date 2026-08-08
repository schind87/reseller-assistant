import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { createListing, listListings } from "@/lib/supabase/queries";

const createSchema = z.object({
  platform: z.enum(["mercari", "poshmark"]),
});

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const listings = await listListings();
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
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose Mercari or Poshmark" },
        { status: 400 }
      );
    }

    const listing = await createListing(parsed.data.platform);
    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    console.error("create listing error:", err);
    return NextResponse.json(
      { error: "Could not create listing" },
      { status: 500 }
    );
  }
}
