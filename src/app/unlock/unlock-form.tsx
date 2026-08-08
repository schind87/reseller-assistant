"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";

export function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Incorrect PIN");
      }
      const next = searchParams.get("next") || "/app";
      router.replace(next.startsWith("/") ? next : "/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock");
    } finally {
      setBusy(false);
    }
  }

  function appendDigit(digit: string) {
    if (pin.length >= 8) return;
    setPin((p) => p + digit);
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Household access
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
          Reseller Assistant
        </h1>
        <p className="mt-3 text-lg text-[var(--muted)]">
          Enter the household PIN once. This device will stay unlocked.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div
          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-6 text-center text-4xl tracking-[0.4em] text-[var(--foreground)]"
          aria-live="polite"
        >
          {pin ? "•".repeat(pin.length) : "————"}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"].map(
            (key) => {
              if (key === "clear") {
                return (
                  <button
                    key={key}
                    type="button"
                    className="touch-target rounded-xl border border-[var(--border)] bg-white text-lg font-semibold"
                    onClick={() => setPin("")}
                  >
                    Clear
                  </button>
                );
              }
              if (key === "del") {
                return (
                  <button
                    key={key}
                    type="button"
                    className="touch-target rounded-xl border border-[var(--border)] bg-white text-lg font-semibold"
                    onClick={backspace}
                  >
                    Delete
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  className="touch-target rounded-xl border border-[var(--border)] bg-white text-2xl font-semibold"
                  onClick={() => appendDigit(key)}
                >
                  {key}
                </button>
              );
            }
          )}
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-base text-red-800">
            {error}
          </p>
        ) : null}

        <BigButton type="submit" disabled={busy || pin.length < 1}>
          {busy ? "Checking…" : "Unlock"}
        </BigButton>
      </form>
    </main>
  );
}
