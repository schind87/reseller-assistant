"use client";

import { useCallback, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";

const REMEMBER_EMAIL_KEY = "ra-remember-email";

function readRememberedEmail(): string {
  try {
    return window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribeRememberedEmail(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rememberedEmail = useSyncExternalStore(
    subscribeRememberedEmail,
    readRememberedEmail,
    () => ""
  );
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [rememberTouched, setRememberTouched] = useState(false);
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const displayEmail = emailTouched ? email : rememberedEmail || email;
  const displayRemember =
    rememberTouched ? rememberEmail : Boolean(rememberedEmail);

  const persistEmailPreference = useCallback(
    (nextEmail: string, remember: boolean) => {
      try {
        if (remember && nextEmail.includes("@")) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, nextEmail.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
        window.dispatchEvent(new Event("storage"));
      } catch {
        // ignore storage failures
      }
    },
    []
  );

  function goApp() {
    persistEmailPreference(displayEmail, displayRemember);
    const next = searchParams.get("next") || "/app";
    router.replace(next.startsWith("/") ? next : "/app");
    router.refresh();
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      persistEmailPreference(displayEmail, displayRemember);
      const res = await fetch("/api/auth/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: displayEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send code");
      setHint(json.message ?? "Check your email for a sign-in code.");
      setCodeSent(true);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: displayEmail, token: code }),
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

  async function loginWithPin() {
    setBusy(true);
    setError(null);
    try {
      persistEmailPreference(displayEmail, displayRemember);
      const res = await fetch("/api/auth/pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: displayEmail, pin }),
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (codeSent) {
      void verifyCode();
      return;
    }
    if (pin.length >= 4) {
      void loginWithPin();
      return;
    }
    void sendCode();
  }

  const emailReady = displayEmail.includes("@");
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
          Guided clothing listings for Mercari and Poshmark.
        </p>
        <p className="mt-3 text-lg text-[var(--muted)]">
          {codeSent
            ? "Enter the code from your email to finish signing in."
            : "Enter your email. Use your PIN if you have one, or get an email code."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-left">
          <span className="text-base font-semibold">Email</span>
          <input
            type="email"
            autoComplete="email"
            name="email"
            className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-xl"
            placeholder="you@email.com"
            value={displayEmail}
            onChange={(e) => {
              setEmailTouched(true);
              setEmail(e.target.value);
            }}
            required
          />
        </label>

        <label className="flex items-center gap-3 text-left text-base text-[var(--foreground)]">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--accent)]"
            checked={displayRemember}
            onChange={(e) => {
              const next = e.target.checked;
              setRememberTouched(true);
              setRememberEmail(next);
              persistEmailPreference(displayEmail, next);
            }}
          />
          <span>Remember this email on this device</span>
        </label>

        <label className="flex flex-col gap-2 text-left">
          <span className="text-base font-semibold">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            name="pin"
            className="touch-target rounded-xl border border-[var(--border)] bg-white px-4 text-center text-3xl tracking-[0.3em]"
            placeholder="••••"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
          />
          <span className="text-sm text-[var(--muted)]">
            Optional — 4 to 8 digits if you already set a PIN.
          </span>
        </label>

        {codeSent ? (
          <label className="flex flex-col gap-2 text-left">
            <span className="text-base font-semibold">Email code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              name="otp"
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
          <p className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-center text-base text-[var(--foreground)]">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-base text-red-800">
            {error}
          </p>
        ) : null}

        {codeSent ? (
          <>
            <BigButton type="submit" disabled={busy || code.length < 4}>
              {busy ? "Checking…" : "Sign in"}
            </BigButton>
            <button
              type="button"
              className="text-base text-[var(--accent)] underline"
              disabled={busy}
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
        ) : (
          <>
            {pinReady ? (
              <BigButton type="submit" disabled={busy || !emailReady}>
                {busy ? "Checking…" : "Sign in with PIN"}
              </BigButton>
            ) : null}

            <BigButton
              type="button"
              variant={pinReady ? "secondary" : undefined}
              disabled={busy || !emailReady}
              onClick={() => void sendCode()}
            >
              {busy ? "Sending…" : "Send me an email code"}
            </BigButton>
          </>
        )}
      </form>
    </main>
  );
}
