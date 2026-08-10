import { redirect } from "next/navigation";
import { AiBgDebugConsole } from "@/components/AiBgDebugConsole";
import { FAL_BG_MODELS } from "@/lib/ai/fal-bg-models";
import { getAdminUser } from "@/lib/admin";
import { listAdminPhotos } from "@/lib/supabase/admin-queries";
import { listRecentBgLabRuns } from "@/lib/supabase/bg-lab";

export default async function AdminAiDebugPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/app");
  }

  const [{ photos, total }, recentRuns] = await Promise.all([
    listAdminPhotos({
      limit: 48,
      role: "all",
    }),
    listRecentBgLabRuns({
      userId: admin.id,
      limit: 24,
    }),
  ]);

  return (
    <AiBgDebugConsole
      initialPhotos={photos}
      initialTotal={total}
      initialRecentRuns={recentRuns.map((run) => ({
        id: run.id,
        createdAt: run.created_at,
        photoId: run.listing_photo_id,
        listingId: run.listing_id,
        photoRole: run.photo_role,
        listingTitle: run.listing_title,
        listingPlatform: run.listing_platform,
        resultCount: run.result_count,
        okCount: run.ok_count,
        modelLabels: run.model_labels,
        thumbUrl: run.thumbUrl,
      }))}
      models={[...FAL_BG_MODELS]}
      hasFalKey={Boolean(process.env.FAL_KEY?.trim())}
    />
  );
}
