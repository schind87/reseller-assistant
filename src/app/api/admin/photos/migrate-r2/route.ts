import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  copyPhotoObjectBatch,
  listPhotoObjectKeysToCopy,
} from "@/lib/migrate-photos-to-r2";
import { isR2Configured } from "@/lib/photo-storage";
import {
  isSafePhotoStoragePath,
  R2_COPY_BATCH_SIZE,
} from "@/lib/r2-copy";

export const maxDuration = 60;
export const runtime = "nodejs";

type Body = {
  action?: "list" | "copy";
  paths?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 is not configured" },
      { status: 503 }
    );
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const action = body.action === "copy" ? "copy" : "list";

  try {
    if (action === "list") {
      const paths = await listPhotoObjectKeysToCopy();
      return NextResponse.json({
        configured: true,
        paths,
        batchSize: R2_COPY_BATCH_SIZE,
      });
    }

    const paths = Array.isArray(body.paths)
      ? body.paths.filter(
          (value): value is string =>
            typeof value === "string" && isSafePhotoStoragePath(value)
        )
      : [];
    if (paths.length === 0) {
      return NextResponse.json(
        { error: "No photo paths to copy" },
        { status: 400 }
      );
    }
    if (paths.length > R2_COPY_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Copy at most ${R2_COPY_BATCH_SIZE} photos per request` },
        { status: 400 }
      );
    }

    const totals = await copyPhotoObjectBatch(paths);
    return NextResponse.json(totals);
  } catch (err) {
    console.error("admin r2 copy error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not copy listing photos",
      },
      { status: 500 }
    );
  }
}
