"use client";

import { QRCodeSVG } from "qrcode.react";

type QrPanelProps = {
  value: string;
  title?: string;
  hint?: string;
  size?: number;
  code?: string | null;
};

export function QrPanel({
  value,
  title = "Scan with your phone",
  hint,
  size = 220,
  code,
}: QrPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 text-center">
      <h2 className="font-[family-name:var(--font-brand)] text-2xl text-[var(--foreground)]">
        {title}
      </h2>
      {hint ? <p className="max-w-sm text-base text-[var(--muted)]">{hint}</p> : null}
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-[var(--border)]">
        <QRCodeSVG value={value} size={size} level="M" includeMargin />
      </div>
      {code ? (
        <p className="text-lg text-[var(--foreground)]">
          Code: <span className="font-semibold tracking-widest">{code}</span>
        </p>
      ) : null}
    </div>
  );
}
