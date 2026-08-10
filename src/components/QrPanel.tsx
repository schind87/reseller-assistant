"use client";

import { QRCodeSVG } from "qrcode.react";

type QrPanelProps = {
  value: string;
  title?: string;
  hint?: string;
  size?: number;
  code?: string | null;
  /** Tighter layout for sticky sidebars. */
  compact?: boolean;
};

export function QrPanel({
  value,
  title = "Scan with your phone",
  hint,
  size,
  code,
  compact = false,
}: QrPanelProps) {
  const qrSize = size ?? (compact ? 132 : 220);

  return (
    <div
      className={
        compact
          ? "flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-3 text-center shadow-sm"
          : "flex flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 text-center"
      }
    >
      <h2
        className={
          compact
            ? "font-[family-name:var(--font-brand)] text-lg leading-tight text-[var(--foreground)]"
            : "font-[family-name:var(--font-brand)] text-2xl text-[var(--foreground)]"
        }
      >
        {title}
      </h2>
      {hint ? (
        <p
          className={
            compact
              ? "max-w-[11rem] text-xs leading-snug text-[var(--muted)]"
              : "max-w-sm text-base text-[var(--muted)]"
          }
        >
          {hint}
        </p>
      ) : null}
      <div
        className={
          compact
            ? "rounded-lg bg-white p-1.5 ring-1 ring-[var(--border)]"
            : "rounded-xl bg-white p-3 shadow-sm ring-1 ring-[var(--border)]"
        }
      >
        <QRCodeSVG value={value} size={qrSize} level="M" includeMargin />
      </div>
      {code ? (
        <p
          className={
            compact
              ? "text-xs text-[var(--foreground)]"
              : "text-lg text-[var(--foreground)]"
          }
        >
          Code:{" "}
          <span className="font-semibold tracking-widest">{code}</span>
        </p>
      ) : null}
    </div>
  );
}
