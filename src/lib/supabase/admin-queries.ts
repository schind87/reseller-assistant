import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/supabase/queries";
import type { ListingPhoto, PhotoRole, Platform } from "@/lib/types";

export type AdminPhotoRow = ListingPhoto & {
  listing_title: string | null;
  listing_platform: Platform;
  listing_user_id: string | null;
  owner_email: string | null;
  signedUrl: string | null;
  processedSignedUrl: string | null;
};

/**
 * Browse listing photos across all users (admin debug only).
 */
export async function listAdminPhotos(opts?: {
  limit?: number;
  offset?: number;
  role?: PhotoRole | "all";
  q?: string;
}): Promise<{ photos: AdminPhotoRow[]; total: number }> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const offset = Math.max(opts?.offset ?? 0, 0);

  let query = supabase
    .from("listing_photos")
    .select(
      `
      *,
      listings!inner (
        id,
        title,
        platform,
        user_id
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts?.role && opts.role !== "all") {
    query = query.eq("role", opts.role);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`listAdminPhotos: ${error.message}`);

  type Raw = ListingPhoto & {
    listings: {
      id: string;
      title: string | null;
      platform: Platform;
      user_id: string | null;
    };
  };

  let rows = (data ?? []) as unknown as Raw[];

  // Optional text filter (title / role / listing id / photo id).
  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) => {
      const hay = [
        row.id,
        row.listing_id,
        row.role,
        row.listings.title ?? "",
        row.listings.user_id ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const userIds = [
    ...new Set(
      rows
        .map((r) => r.listings.user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const emailByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    if (profileError) {
      console.error("listAdminPhotos profiles:", profileError.message);
    } else {
      for (const p of profiles ?? []) {
        emailByUser.set(p.id as string, (p.email as string | null) ?? null);
      }
    }
  }

  const photos: AdminPhotoRow[] = await Promise.all(
    rows.map(async (row) => {
      const { listings, ...photo } = row;
      const ownerId = listings.user_id;
      return {
        ...(photo as ListingPhoto),
        listing_title: listings.title,
        listing_platform: listings.platform,
        listing_user_id: ownerId,
        owner_email: ownerId ? (emailByUser.get(ownerId) ?? null) : null,
        signedUrl: await getSignedPhotoUrl(photo.storage_path),
        processedSignedUrl: photo.processed_path
          ? await getSignedPhotoUrl(photo.processed_path)
          : null,
      };
    })
  );

  return { photos, total: count ?? photos.length };
}

export async function getAdminPhotoById(
  photoId: string
): Promise<AdminPhotoRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_photos")
    .select(
      `
      *,
      listings!inner (
        id,
        title,
        platform,
        user_id
      )
    `
    )
    .eq("id", photoId)
    .maybeSingle();

  if (error) throw new Error(`getAdminPhotoById: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as ListingPhoto & {
    listings: {
      id: string;
      title: string | null;
      platform: Platform;
      user_id: string | null;
    };
  };

  let ownerEmail: string | null = null;
  if (row.listings.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", row.listings.user_id)
      .maybeSingle();
    ownerEmail = (profile?.email as string | null) ?? null;
  }

  const { listings, ...photo } = row;
  return {
    ...(photo as ListingPhoto),
    listing_title: listings.title,
    listing_platform: listings.platform,
    listing_user_id: listings.user_id,
    owner_email: ownerEmail,
    signedUrl: await getSignedPhotoUrl(photo.storage_path),
    processedSignedUrl: photo.processed_path
      ? await getSignedPhotoUrl(photo.processed_path)
      : null,
  };
}
