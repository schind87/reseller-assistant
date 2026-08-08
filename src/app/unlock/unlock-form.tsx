"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";

type Mode = "email-code" | "pin";
type Step = "email" | "code";

export function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("email-code");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function goApp() {
    const next = searchParams.get("next") || "/app";
    router.replace(next.startsWith("/") ? next : "/app");
    router.refresh();
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send code");
      setHint(json.message ?? "Check your email for a sign-in code.");
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
        body: JSON.stringify({ email, token: code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "That code did not work");
      goApp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not sign in");
      goApp();
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
          {mode === "pin"
            ? "Sign in with your email and the PIN you chose."
            : step === "email"
              ? "Enter your email. We’ll send a one-time code."
              : "Type the 6-digit code from your email."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-white p-2">
        <button
          type="button"
          className={`touch-target rounded-xl text-base font-semibold ${
            mode === "email-code"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--foreground)]"
          }`}
          onClick={() => {
            setMode("email-code");
            setStep("email");
            setError(null);
            setHint(null);
            setCode("");
            setPin("");
          }}
        >
          Email code
        </button>
        <button
          type="button"
          className={`touch-target rounded-xl text-base font-semibold ${
            mode === "pin"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--foreground)]"
          }`}
          onClick={() => {
            setMode("pin");
            setError(null);
            setHint(null);
            setCode("");
          }}
        >
          My PIN
        </button>
      </div>

      {mode === "email-code" && step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-left">
            <span className="text-base font-semibold">Email</span>
            <input
              type="email"
              autoComplete="email"
              className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-xl"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-base text-red-800">
              {error}
            </p>
          ) : null}

          <BigButton type="submit" disabled={busy || !email.includes("@")}>
            {busy ? "Sending…" : "Send me a code"}
          </BigButton>
        </form>
      ) : null}

      {mode === "email-code" && step === "code" ? (
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
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
              setStep("email");
              setCode("");
              setError(null);
              setHint(null);
            }}
          >
            Use a different email
          </button>
        </form>
      ) : null}

      {mode === "pin" ? (
        <form onSubmit={loginWithPin} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-left">
            <span className="text-base font-semibold">Email</span>
            <input
              type="email"
              autoComplete="email"
              className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-xl"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-left">
            <span className="text-base font-semibold">Your PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-center text-3xl tracking-[0.3em]"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              required
            />
            <span className="text-sm text-[var(--muted)]">4 to 8 digits</span>
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-base text-red-800">
              {error}
            </p>
          ) : null}

          <BigButton
            type="submit"
            disabled={busy || !email.includes("@") || pin.length < 4}
          >
            {busy ? "Checking…" : "Sign in with PIN"}
          </BigButton>

          <p className="text-center text-base text-[var(--muted)]">
            No PIN yet? Use <strong>Email code</strong> first, then set a PIN on
            the home screen.
          </p>
        </form>
      ) : null}
    </main>
  );
}
