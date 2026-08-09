"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";
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
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const purpose = searchParams.get("purpose");

  const runJoin = useCallback(async () => {
    const token = params.token;
    if (!token) {
      setBusy(false);
      setError("This QR link is missing a token. Scan the code again.");
      return;
    }

    setBusy(true);
    setError(null);
    setExtensionMessage(null);

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
        if (ack.ok) {
          setExtensionMessage(
            "Extension connected. Open the Reseller Assistant side panel to fill Mercari or Poshmark."
          );
          setBusy(false);
          return;
        }

        setExtensionMessage(
          "Pairing link is ready, but the Chrome extension was not detected. Load unpacked from extension-live, then retry or enter the 6-digit code in the side panel."
        );
        setBusy(false);
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
      router.replace(`/app/listings/${json.listingId}/photos?phone=1`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not join");
    }
  }, [params.token, purpose, router]);

  useEffect(() => {
    void runJoin();
  }, [attempt, runJoin]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
        {error
          ? "Couldn’t join listing"
          : purpose === "extension"
            ? "Pairing extension…"
            : "Joining listing…"}
      </h1>
      {error ? (
        <div className="flex w-full flex-col gap-4">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
            {error}
          </p>
          <p className="text-base text-[var(--muted)]">
            Check that you scanned the current QR on the listing hub, then try
            again.
          </p>
          <BigButton
            disabled={busy}
            onClick={() => {
              setAttempt((n) => n + 1);
            }}
          >
            {busy ? "Retrying…" : "Retry QR join"}
          </BigButton>
          <a href="/unlock" className="text-lg font-semibold text-[var(--accent)]">
            Sign in instead
          </a>
        </div>
      ) : extensionMessage ? (
        <div className="flex w-full flex-col gap-4">
          <p className="text-lg text-[var(--muted)]">{extensionMessage}</p>
          {extensionMessage.includes("not detected") ? (
            <BigButton
              disabled={busy}
              onClick={() => {
                setAttempt((n) => n + 1);
              }}
            >
              {busy ? "Retrying…" : "Retry pairing"}
            </BigButton>
          ) : null}
        </div>
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
