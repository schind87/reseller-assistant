"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BigButton } from "@/components/BigButton";

export function PinSetupCard() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/pin");
        const json = await res.json();
        if (!cancelled && res.ok) {
          setHasPin(Boolean(json.hasPin));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, confirmPin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save PIN");
      setHasPin(true);
      setOpen(false);
      setPin("");
      setConfirmPin("");
      setMessage("Your PIN is saved. Next time you can sign in with email + PIN.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-brand)] text-2xl">
            Your PIN
          </h2>
          <p className="mt-1 text-base text-[var(--muted)]">
            {hasPin
              ? "You can sign in with email + PIN instead of an email code."
              : "Optional: choose a 4–8 digit PIN for faster sign-in next time."}
          </p>
        </div>
        <button
          type="button"
          className="text-base font-semibold text-[var(--accent)]"
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
            setMessage(null);
          }}
        >
          {open ? "Close" : hasPin ? "Change PIN" : "Set PIN"}
        </button>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-base text-[var(--foreground)]">
          {message}
        </p>
      ) : null}

      {open ? (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-base font-semibold">New PIN</span>
            <input
              type="password"
              inputMode="numeric"
              className="touch-target rounded-xl border border-[var(--border)] px-4 text-center text-2xl tracking-[0.3em]"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              placeholder="••••"
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-base font-semibold">Type it again</span>
            <input
              type="password"
              inputMode="numeric"
              className="touch-target rounded-xl border border-[var(--border)] px-4 text-center text-2xl tracking-[0.3em]"
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              placeholder="••••"
              required
            />
          </label>
          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
              {error}
            </p>
          ) : null}
          <BigButton
            type="submit"
            disabled={busy || pin.length < 4 || confirmPin.length < 4}
          >
            {busy ? "Saving…" : "Save my PIN"}
          </BigButton>
        </form>
      ) : null}
    </section>
  );
}
