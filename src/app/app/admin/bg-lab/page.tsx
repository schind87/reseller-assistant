import { redirect } from "next/navigation";
import { AiBgDebugConsole } from "@/components/AiBgDebugConsole";
import { FAL_BG_MODELS } from "@/lib/ai/fal-bg-models";
import { getAdminUser } from "@/lib/admin";
import {
  getAdminPhotoById,
  listAdminPhotos,
} from "@/lib/supabase/admin-queries";
import {
  countBgLabSavedResultsByPhotoIds,
  listBgLabModelCostAverages,
  listBgLabModelRatingStats,
  listRecentBgLabRuns,
} from "@/lib/supabase/bg-lab";
import { isIdentifyPhotoRole, type PhotoRole } from "@/lib/types";

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

  const [
    { photos: listed, total },
    recentRuns,
    costAverages,
    ratingStats,
    deepPhoto,
  ] = await Promise.all([
      listAdminPhotos({
        limit: 48,
        role: "all",
        // Only listing deep-links narrow the picker; photo deep-links just select.
        q: deepListingId || undefined,
      }),
      listRecentBgLabRuns({
        userId: admin.id,
        limit: 24,
      }),
      listBgLabModelCostAverages({ userId: admin.id }),
      listBgLabModelRatingStats({ userId: admin.id }),
      deepPhotoId ? getAdminPhotoById(deepPhotoId) : Promise.resolve(null),
    ]);

  const photos = (() => {
    if (!deepPhoto || isIdentifyPhotoRole(deepPhoto.role)) return listed;
    if (listed.some((p) => p.id === deepPhoto.id)) return listed;
    return [deepPhoto, ...listed];
  })();

  const savedResultCounts = await countBgLabSavedResultsByPhotoIds(
    photos.map((p) => p.id),
  );

  const selectedPhotoId =
    deepPhotoId && deepPhoto && !isIdentifyPhotoRole(deepPhoto.role)
      ? deepPhotoId
      : null;

  return (
    <AiBgDebugConsole
      initialPhotos={photos}
      initialTotal={
        deepPhoto &&
        !isIdentifyPhotoRole(deepPhoto.role) &&
        total === listed.length
          ? total + 1
          : total
      }
      initialSelectedPhotoId={selectedPhotoId}
      initialListingFilter={deepListingId}
      initialSavedResultCounts={savedResultCounts}
      initialRecentRuns={recentRuns
        .filter((run) => {
          const role = run.photo_role as PhotoRole | null;
          return !role || !isIdentifyPhotoRole(role);
        })
        .map((run) => ({
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
      initialModelRatingStats={ratingStats.map((row) => ({
        modelId: row.modelId,
        upCount: row.upCount,
        downCount: row.downCount,
      }))}
      models={[...FAL_BG_MODELS]}
      hasFalKey={Boolean(process.env.FAL_KEY?.trim())}
    />
  );
}
