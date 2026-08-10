import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { updateBgLabResultRating } from "@/lib/supabase/bg-lab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  resultId: z.string().uuid(),
  rating: z.enum(["up", "down"]).nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose thumbs up, thumbs down, or clear." },
      { status: 400 },
    );
  }

  try {
    const rating = await updateBgLabResultRating({
      resultId: parsed.data.resultId,
      rating: parsed.data.rating,
    });
    return NextResponse.json({ resultId: parsed.data.resultId, rating });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save rating";
    const status = message === "Result not found" ? 404 : 500;
    if (status === 500) console.error("bg-debug rate error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
