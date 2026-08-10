import { redirect } from "next/navigation";
import { AiBgDebugConsole } from "@/components/AiBgDebugConsole";
import { FAL_BG_MODELS } from "@/lib/ai/fal-bg-models";
import { getAdminUser } from "@/lib/admin";
import {
  getAdminPhotoById,
  listAdminPhotos,
} from "@/lib/supabase/admin-queries";
import {
  listBgLabModelCostAverages,
  listRecentBgLabRuns,
} from "@/lib/supabase/bg-lab";

type PageProps = {
  searchParams: Promise<{ photoId?: string; listingId?: string }>;
};

export default async function AdminAiDebugPage({ searchParams }: PageProps) {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/app");
  }

  const sp = await searchParams;
  const deepPhotoId = sp.photoId?.trim() || null;
  const deepListingId = sp.listingId?.trim() || null;

  const [{ photos: listed, total }, recentRuns, costAverages, deepPhoto] =
    await Promise.all([
      listAdminPhotos({
        limit: 48,
        role: "all",
        q: deepListingId || deepPhotoId || undefined,
      }),
      listRecentBgLabRuns({
        userId: admin.id,
        limit: 24,
      }),
      listBgLabModelCostAverages({ userId: admin.id }),
      deepPhotoId ? getAdminPhotoById(deepPhotoId) : Promise.resolve(null),
    ]);

  const photos = (() => {
    if (!deepPhoto) return listed;
    if (listed.some((p) => p.id === deepPhoto.id)) return listed;
    return [deepPhoto, ...listed];
  })();

  return (
    <AiBgDebugConsole
      initialPhotos={photos}
      initialTotal={deepPhoto && total === listed.length ? total + 1 : total}
      initialSelectedPhotoId={deepPhotoId}
      initialListingFilter={deepListingId}
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
      initialModelCostAverages={costAverages.map((row) => ({
        modelId: row.modelId,
        avgUsd: row.avgUsd,
        sampleCount: row.sampleCount,
      }))}
      models={[...FAL_BG_MODELS]}
      hasFalKey={Boolean(process.env.FAL_KEY?.trim())}
    />
  );
}
