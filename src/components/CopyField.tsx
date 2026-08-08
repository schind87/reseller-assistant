"use client";

import { useState } from "react";

type CopyFieldProps = {
  label: string;
  value: string;
  multiline?: boolean;
};

export function CopyField({ label, value, multiline = false }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-base font-semibold text-[var(--foreground)]">
          {label}
        </label>
        <button
          type="button"
          onClick={handleCopy}
          className="touch-target rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-base font-semibold text-[var(--accent)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {multiline ? (
        <pre className="whitespace-pre-wrap break-words text-base leading-relaxed text-[var(--foreground)]">
          {value || "—"}
        </pre>
      ) : (
        <p className="break-words text-base text-[var(--foreground)]">
          {value || "—"}
        </p>
      )}
    </div>
  );
}
