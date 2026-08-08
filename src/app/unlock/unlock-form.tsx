"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";

type Step = "contact" | "code";

export function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send code");
      setHint(json.message ?? "Check for your sign-in code.");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, token: code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "That code did not work");
      const next = searchParams.get("next") || "/app";
      router.replace(next.startsWith("/") ? next : "/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Sign in
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
          Reseller Assistant
        </h1>
        <p className="mt-3 text-lg text-[var(--muted)]">
          {step === "contact"
            ? "Enter your email or phone number. No password needed."
            : "Type the 6-digit code from your email."}
        </p>
      </div>

      {step === "contact" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-left">
            <span className="text-base font-semibold">Email or phone</span>
            <input
              type="text"
              inputMode="email"
              autoComplete="username"
              className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-xl"
              placeholder="you@email.com or 555-123-4567"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-base text-red-800">
              {error}
            </p>
          ) : null}

          <BigButton type="submit" disabled={busy || contact.trim().length < 3}>
            {busy ? "Sending…" : "Send me a code"}
          </BigButton>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-5">
          {hint ? (
            <p className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-center text-base text-[var(--foreground)]">
              {hint}
            </p>
          ) : null}

          <label className="flex flex-col gap-2 text-left">
            <span className="text-base font-semibold">Sign-in code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-center text-3xl tracking-[0.3em]"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              required
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-base text-red-800">
              {error}
            </p>
          ) : null}

          <BigButton type="submit" disabled={busy || code.length < 4}>
            {busy ? "Checking…" : "Sign in"}
          </BigButton>

          <button
            type="button"
            className="text-base text-[var(--accent)] underline"
            onClick={() => {
              setStep("contact");
              setCode("");
              setError(null);
              setHint(null);
            }}
          >
            Use a different email or phone
          </button>
        </form>
      )}
    </main>
  );
}
