"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Old post-checklist URL — posting now starts from the listing hub. */
export default function PostPageRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!params.id) return;
    router.replace(`/app/listings/${params.id}`);
  }, [params.id, router]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-lg text-[var(--muted)]">
      Opening listing…
    </main>
  );
}
