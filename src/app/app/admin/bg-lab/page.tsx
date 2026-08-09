import { redirect } from "next/navigation";
import { AiBgDebugConsole } from "@/components/AiBgDebugConsole";
import { FAL_BG_MODELS } from "@/lib/ai/fal-bg-models";
import { getAdminUser } from "@/lib/admin";
import { listAdminPhotos } from "@/lib/supabase/admin-queries";

export default async function AdminAiDebugPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/app");
  }

  const { photos, total } = await listAdminPhotos({
    limit: 48,
    role: "cover",
  });

  return (
    <AiBgDebugConsole
      initialPhotos={photos}
      initialTotal={total}
      models={[...FAL_BG_MODELS]}
      hasFalKey={Boolean(process.env.FAL_KEY?.trim())}
    />
  );
}
