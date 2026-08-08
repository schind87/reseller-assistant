"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  requestExtensionPair,
  waitForExtensionPairAck,
} from "@/lib/extension-bridge";

export function JoinTokenClient() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [extensionMessage, setExtensionMessage] = useState<string | null>(null);
  const purpose = searchParams.get("purpose");

  useEffect(() => {
    const token = params.token;
    if (!token) return;

    let cancelled = false;

    async function join() {
      try {
        if (purpose === "extension") {
          setExtensionMessage("Connecting Chrome extension…");
          const pairRes = await fetch(
            `/api/extension/pair?token=${encodeURIComponent(token)}`
          );
          const pairJson = await pairRes.json();
          if (!pairRes.ok) {
            throw new Error(pairJson.error ?? "Could not pair extension");
          }

          requestExtensionPair({
            token: String(pairJson.token),
            listingId: String(pairJson.listingId),
            joinCode: pairJson.joinCode ?? null,
            openSidePanel: true,
          });

          const ack = await waitForExtensionPairAck(2000);
          if (cancelled) return;
          if (ack.ok) {
            setExtensionMessage(
              "Extension connected. Open the Reseller Assistant side panel to fill Mercari or Poshmark."
            );
            return;
          }

          setExtensionMessage(
            "Pairing link is ready, but the Chrome extension was not detected. Load unpacked from extension-live, then reopen this page or enter the 6-digit code in the side panel."
          );
          return;
        }

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
        router.replace(`/app/listings/${json.listingId}/photos?phone=1`);
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
  }, [params.token, purpose, router]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
        {purpose === "extension" ? "Pairing extension…" : "Joining listing…"}
      </h1>
      {error ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
            {error}
          </p>
          <a href="/unlock" className="text-lg font-semibold text-[var(--accent)]">
            Sign in instead
          </a>
        </div>
      ) : extensionMessage ? (
        <p className="text-lg text-[var(--muted)]">{extensionMessage}</p>
      ) : (
        <p className="text-lg text-[var(--muted)]">
          {purpose === "extension"
            ? "Handing this listing to your Chrome extension."
            : "Unlocking this phone and opening the photo coach."}
        </p>
      )}
    </main>
  );
}
