"use client";

import { useCallback, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import {
  clearRememberedIdentity,
  getRememberedIdentitySnapshot,
  parseRememberedIdentity,
  readRememberedIdentity,
  rememberedHasPinForEmail,
  saveRememberedIdentity,
  subscribeRememberedIdentity,
} from "@/lib/remembered-identity";
import { safeInternalPath } from "@/lib/safe-internal-path";

type BusyAction = "pin" | "send" | "verify" | null;

export function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rememberedRaw = useSyncExternalStore(
    subscribeRememberedIdentity,
    getRememberedIdentitySnapshot,
    () => ""
  );
  const remembered = parseRememberedIdentity(rememberedRaw);
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const [rememberOverride, setRememberOverride] = useState<boolean | null>(
    null
  );
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);

  const email = typedEmail ?? remembered?.email ?? "";
  const rememberEmail = rememberOverride ?? Boolean(remembered);
  const knownPin = rememberedHasPinForEmail(remembered, email);
  const showPin = knownPin && !codeSent;

  const persistIdentity = useCallback(
    (nextEmail: string, remember: boolean, hasPin?: boolean) => {
      if (!remember) {
        clearRememberedIdentity();
        return;
      }
      const existing = readRememberedIdentity();
      const nextHasPin =
        typeof hasPin === "boolean"
          ? hasPin
          : Boolean(
              existing &&
                rememberedHasPinForEmail(existing, nextEmail)
            );
      saveRememberedIdentity(nextEmail, nextHasPin);
    },
    []
  );

  function goApp() {
    router.replace(safeInternalPath(searchParams.get("next")));
    router.refresh();
  }

  async function sendCode() {
    setBusy("send");
    setError(null);
    try {
      persistIdentity(email, rememberEmail);
      const res = await fetch("/api/auth/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send code");
      setHint(json.message ?? "Check your email for a sign-in code.");
      setCodeSent(true);
      setCode("");
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode() {
    setBusy("verify");
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "That code did not work. Try again."
        );
      }
      persistIdentity(email, rememberEmail, Boolean(json.hasPin));
      goApp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(null);
    }
  }

  async function loginWithPin() {
    setBusy("pin");
    setError(null);
    try {
      persistIdentity(email, rememberEmail);
      const res = await fetch("/api/auth/pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not sign in");
      persistIdentity(email, rememberEmail, true);
      goApp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (codeSent) {
      if (code.length >= 4) void verifyCode();
      return;
    }
    if (showPin) {
      if (pin.length >= 4) void loginWithPin();
      return;
    }
    if (email.includes("@")) void sendCode();
  }

  const emailReady = email.includes("@");
  const pinReady = pin.length >= 4;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Sign in
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
          Reseller Assistant
        </h1>
        <p className="mt-1 text-base text-[var(--muted)]">
          Clothing listings for Mercari and Poshmark.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-left">
          <span className="text-base font-semibold">Email</span>
          <input
            type="email"
            autoComplete="email"
            name="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-xl"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setTypedEmail(e.target.value)}
            required
          />
        </label>

        <label className="flex items-center gap-3 text-left text-base text-[var(--foreground)]">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--accent)]"
            checked={rememberEmail}
            onChange={(e) => {
              const next = e.target.checked;
              if (!next) setTypedEmail(email);
              setRememberOverride(next);
              persistIdentity(email, next);
            }}
          />
          <span>Remember this email on this device</span>
        </label>

        {showPin ? (
          <label className="flex flex-col gap-2 text-left">
            <span className="text-base font-semibold">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              name="pin"
              spellCheck={false}
              className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-center text-3xl tracking-[0.3em]"
              placeholder="••••"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
            />
          </label>
        ) : null}

        {codeSent ? (
          <label className="flex flex-col gap-2 text-left">
            <span className="text-base font-semibold">Email code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              name="otp"
              spellCheck={false}
              className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-center text-3xl tracking-[0.3em]"
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
            />
          </label>
        ) : null}

        {hint ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-center text-base text-[var(--foreground)]"
          >
            {hint}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            aria-live="assertive"
            className="rounded-xl bg-red-50 px-4 py-3 text-center text-base text-red-800"
          >
            {error}
          </p>
        ) : null}

        {codeSent ? (
          <>
            <BigButton type="submit" disabled={Boolean(busy) || code.length < 4}>
              {busy === "verify" ? "Checking…" : "Sign in"}
            </BigButton>
            <BigButton
              type="button"
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => void sendCode()}
            >
              {busy === "send" ? "Sending…" : "Send again"}
            </BigButton>
            <button
              type="button"
              className="text-base font-semibold text-[var(--accent)]"
              disabled={Boolean(busy)}
              onClick={() => {
                setCodeSent(false);
                setCode("");
                setHint(null);
                setError(null);
              }}
            >
              Back
            </button>
          </>
        ) : showPin ? (
          <>
            <BigButton
              type="submit"
              disabled={Boolean(busy) || !emailReady || !pinReady}
            >
              {busy === "pin" ? "Checking…" : "Sign in with PIN"}
            </BigButton>
            <BigButton
              type="button"
              variant="ghost"
              disabled={Boolean(busy) || !emailReady}
              onClick={() => void sendCode()}
            >
              {busy === "send" ? "Sending…" : "Email me a code instead"}
            </BigButton>
          </>
        ) : (
          <BigButton
            type="submit"
            disabled={Boolean(busy) || !emailReady}
          >
            {busy === "send" ? "Sending…" : "Send me an email code"}
          </BigButton>
        )}
      </form>
      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/privacy" className="text-[var(--accent)] hover:underline">
          Privacy
        </Link>
      </p>
    </main>
  );
}
