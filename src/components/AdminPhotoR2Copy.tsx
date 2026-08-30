"use client";

import { useState } from "react";
import { BigButton } from "@/components/BigButton";
import {
  addR2CopyTotals,
  emptyR2CopyTotals,
  R2_COPY_BATCH_SIZE,
  type R2CopyTotals,
} from "@/lib/r2-copy";

type ListResponse = {
  configured?: boolean;
  paths?: string[];
  batchSize?: number;
  error?: string;
};

function formatDone(done: R2CopyTotals): string {
  if (done.copied + done.skipped + done.failed === 0) {
    return "No listing photos to copy.";
  }
  const parts: string[] = [];
  if (done.copied > 0) parts.push(`Copied ${done.copied}`);
  if (done.skipped > 0) {
    parts.push(
      parts.length === 0
        ? `Already on R2 ${done.skipped}`
        : `already on R2 ${done.skipped}`
    );
  }
  if (done.failed > 0) parts.push(`could not copy ${done.failed}`);
  return parts.join(" · ");
}

export function AdminPhotoR2Copy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState<R2CopyTotals | null>(null);

  async function copyAll() {
    setBusy(true);
    setError(null);
    setDone(null);
    setProgress("Listing photos…");
    let totals = emptyR2CopyTotals();
    try {
      const listRes = await fetch("/api/admin/photos/migrate-r2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const listJson = (await listRes.json().catch(() => ({}))) as ListResponse;
      if (!listRes.ok) {
        throw new Error(listJson.error ?? "Could not list photos");
      }
      const paths = listJson.paths ?? [];
      const batchSize = listJson.batchSize ?? R2_COPY_BATCH_SIZE;
      if (paths.length === 0) {
        setDone(emptyR2CopyTotals());
        setProgress(null);
        return;
      }

      for (let i = 0; i < paths.length; i += batchSize) {
        const chunk = paths.slice(i, i + batchSize);
        setProgress(
          `Copying listing photos… ${Math.min(i + chunk.length, paths.length)} of ${paths.length}`
        );
        const copyRes = await fetch("/api/admin/photos/migrate-r2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "copy", paths: chunk }),
        });
        const copyJson = (await copyRes.json().catch(() => ({}))) as
          | (R2CopyTotals & { error?: string })
          | { error?: string };
        if (!copyRes.ok) {
          throw new Error(copyJson.error ?? "Could not copy listing photos");
        }
        totals = addR2CopyTotals(totals, copyJson as R2CopyTotals);
        setDone(totals);
      }
      setProgress(null);
    } catch (err) {
      if (totals.copied + totals.skipped + totals.failed > 0) {
        setDone(totals);
      }
      setError(
        err instanceof Error ? err.message : "Could not copy listing photos"
      );
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col items-start gap-3" aria-busy={busy}>
      <BigButton
        disabled={busy}
        fullWidth={false}
        onClick={() => void copyAll()}
      >
        {busy ? "Copying listing photos…" : "Copy listing photos to R2"}
      </BigButton>
      {progress ? (
        <p aria-live="polite" className="text-base text-[var(--muted)]">
          {progress}
        </p>
      ) : null}
      {done ? (
        <p aria-live="polite" className="text-base text-[var(--foreground)]">
          {formatDone(done)}
        </p>
      ) : null}
      {done && done.failedPaths.length > 0 ? (
        <ul className="max-w-full list-disc pl-5 text-sm text-[var(--muted)]">
          {done.failedPaths.map((path) => (
            <li key={path} className="break-all font-mono">
              {path}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-base text-red-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}
