import { Suspense } from "react";
import { ListingHub } from "@/components/ListingHub";
import { isAdminEmail } from "@/lib/admin";
import { getAuthUser } from "@/lib/api-auth";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingHubPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getAuthUser();
  const isAdmin = isAdminEmail(user?.email);

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-10 text-lg text-[var(--muted)]">
          Loading listing…
        </div>
      }
    >
      <ListingHub listingId={id} isAdmin={isAdmin} />
    </Suspense>
  );
}
