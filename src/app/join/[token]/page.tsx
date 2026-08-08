"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function JoinTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.token;
    if (!token) return;

    let cancelled = false;

    async function join() {
      try {
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Could not join");
        }
        if (cancelled) return;
        router.replace(
          `/app/listings/${json.listingId}/photos?phone=1`
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not join");
        }
      }
    }

    void join();
    return () => {
      cancelled = true;
    };
  }, [params.token, router]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
        Joining listing…
      </h1>
      {error ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
            {error}
          </p>
          <a href="/unlock" className="text-lg font-semibold text-[var(--accent)]">
            Enter PIN instead
          </a>
        </div>
      ) : (
        <p className="text-lg text-[var(--muted)]">
          Unlocking this phone and opening the photo coach.
        </p>
      )}
    </main>
  );
}
