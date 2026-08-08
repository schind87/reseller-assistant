import JSZip from "jszip";
import { NextResponse } from "next/server";
import { authorizeListingAccess } from "@/lib/listing-access";
import {
  getListingWithPhotos,
  getSignedPhotoUrl,
} from "@/lib/supabase/queries";
import { isPostingPhotoRole, type PhotoRole } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

const ROLE_ORDER: PhotoRole[] = [
  "cover",
  "front",
  "back",
  "detail",
  "flaw",
];

function extensionForContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await authorizeListingAccess(id, { writeRequiresOwner: true });
  if (access.error) return access.error;

  try {
    const result = await getListingWithPhotos(id);
    if (!result) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const posting = result.photos
      .filter((photo) => isPostingPhotoRole(photo.role))
      .sort((a, b) => {
        const ai = ROLE_ORDER.indexOf(a.role);
        const bi = ROLE_ORDER.indexOf(b.role);
        const aRank = ai === -1 ? 99 : ai;
        const bRank = bi === -1 ? 99 : bi;
        if (aRank !== bRank) return aRank - bRank;
        return a.sort_order - b.sort_order;
      });

    if (posting.length === 0) {
      return NextResponse.json(
        { error: "No listing photos to download yet." },
        { status: 400 }
      );
    }

    const zip = new JSZip();
    let added = 0;

    for (const photo of posting) {
      const path = photo.processed_path || photo.storage_path;
      const signed = await getSignedPhotoUrl(path);
      if (!signed) continue;

      const res = await fetch(signed);
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      const contentType =
        res.headers.get("content-type") || "image/jpeg";
      const ext = extensionForContentType(contentType);
      const index = String(added + 1).padStart(2, "0");
      zip.file(`${index}-${photo.role}.${ext}`, bytes);
      added += 1;
    }

    if (added === 0) {
      return NextResponse.json(
        { error: "Could not download listing photos." },
        { status: 500 }
      );
    }

    const archive = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    const titleSlug = (result.listing.title || "listing")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    return new NextResponse(new Uint8Array(archive), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${titleSlug || "listing"}-photos.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("photos zip error:", err);
    return NextResponse.json(
      { error: "Could not build photo zip" },
      { status: 500 }
    );
  }
}
