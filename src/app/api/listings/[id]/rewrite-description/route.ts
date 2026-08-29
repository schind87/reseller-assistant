import { NextResponse } from "next/server";
import { z } from "zod";
import { rewriteListingDescription } from "@/lib/ai/draft";
import { getProfileById } from "@/lib/auth/otp";
import { authorizeListingAccess } from "@/lib/listing-access";
import {
  composeSellerContext,
  defaultListingPreferences,
} from "@/lib/seller-preferences";
import { updateListing } from "@/lib/supabase/queries";
import {
  emptyStructuredFields,
  type Platform,
  type StructuredFields,
} from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  title: z.string().optional(),
  price: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  structured_fields: z.record(z.string(), z.unknown()).optional(),
  /** Fields snapshot from when the description was last AI-written (for surgical updates). */
  previous_structured_fields: z.record(z.string(), z.unknown()).optional(),
  save: z.boolean().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeListingAccess(id, { writeRequiresOwner: true });
  if (access.error) return access.error;

  try {
    const listing = access.listing;
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const title = parsed.data.title ?? listing.title ?? "";
    const price =
      parsed.data.price !== undefined ? parsed.data.price : listing.price;
    const currentDescription =
      parsed.data.description !== undefined
        ? parsed.data.description
        : listing.description;
    const fields: StructuredFields = {
      ...emptyStructuredFields(),
      ...listing.structured_fields,
      ...(parsed.data.structured_fields as Partial<StructuredFields> | undefined),
    };
    const previousFields = parsed.data.previous_structured_fields
      ? ({
          ...emptyStructuredFields(),
          ...(parsed.data.previous_structured_fields as Partial<StructuredFields>),
        } satisfies StructuredFields)
      : null;

    const profileOwnerId = listing.user_id ?? access.userId;
    const profile = profileOwnerId
      ? await getProfileById(profileOwnerId).catch(() => null)
      : null;
    const prefs =
      profile?.listing_preferences ?? defaultListingPreferences();

    const result = await rewriteListingDescription({
      platform: listing.platform as Platform,
      title,
      price,
      fields,
      currentDescription,
      previousFields,
      sellerContext: composeSellerContext(prefs),
    });

    if (parsed.data.save !== false) {
      await updateListing(id, {
        description: result.description,
        status: "ready",
      });
    }

    return NextResponse.json({
      description: result.description,
      degraded: result.degraded,
      message: result.message ?? null,
    });
  } catch (err) {
    console.error("rewrite-description error:", err);
    return NextResponse.json(
      { error: "Could not rewrite description" },
      { status: 500 }
    );
  }
}
