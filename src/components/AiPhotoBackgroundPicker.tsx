"use client";

import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ListingPhotoWithUrl } from "@/lib/types";

export type AiBackgroundResult = {
  id: string;
  modelId: string;
  modelLabel: string;
  imageUrl: string | null;
  rating: "up" | "down" | null;
  createdAt: string;
  modelUpCount: number;
  modelDownCount: number;
};

type AiPhotoBackgroundPickerProps = {
  listingId: string;
  photo: ListingPhotoWithUrl;
  isAdmin?: boolean;
  busy?: boolean;
  onClose: () => void;
  onApplied: (photo: ListingPhotoWithUrl) => void;
  onRunNew: () => void;
  onRate?: (
    resultId: string,
    rating: "up" | "down" | null
  ) => Promise<"up" | "down" | null>;
};

export function AiPhotoBackgroundPicker({
  listingId,
  photo,
  isAdmin = false,
  busy = false,
  onClose,
  onApplied,
  onRunNew,
  onRate,
}: AiPhotoBackgroundPickerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [results, setResults] = useState<AiBackgroundResult[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [preview, setPreview] = useState<AiBackgroundResult | null>(null);
  const [ratingBusyId, setRatingBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/listings/${listingId}/photos/${photo.id}/ai-background`
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json.error === "string"
              ? json.error
              : "Could not load AI results"
          );
        }
        if (cancelled) return;
        setOriginalUrl(
          typeof json.originalUrl === "string" ? json.originalUrl : null
        );
        setResults(
          Array.isArray(json.results)
            ? (json.results as AiBackgroundResult[])
            : []
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load AI results");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId, photo.id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (preview) setPreview(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, preview]);

  async function applyResult(resultId: string) {
    setApplyingId(resultId);
    setError(null);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/photos/${photo.id}/ai-background`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not apply result"
        );
      }
      onApplied(json.photo as ListingPhotoWithUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply result");
    } finally {
      setApplyingId(null);
    }
  }

  async function restoreOriginal() {
    setRestoring(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/photos/${photo.id}/ai-background`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restore: true }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Could not restore original"
        );
      }
      onApplied(json.photo as ListingPhotoWithUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not restore original"
      );
    } finally {
      setRestoring(false);
    }
  }

  async function toggleRate(result: AiBackgroundResult, next: "up" | "down") {
    if (!onRate || !isAdmin) return;
    setRatingBusyId(result.id);
    try {
      const previous = result.rating;
      const rating = previous === next ? null : next;
      const saved = await onRate(result.id, rating);
      setResults((prev) =>
        prev.map((row) => {
          if (row.id !== result.id) return row;
          let up = row.modelUpCount;
          let down = row.modelDownCount;
          if (previous === "up") up = Math.max(0, up - 1);
          if (previous === "down") down = Math.max(0, down - 1);
          if (saved === "up") up += 1;
          if (saved === "down") down += 1;
          return {
            ...row,
            rating: saved,
            modelUpCount: up,
            modelDownCount: down,
          };
        })
      );
      if (preview?.id === result.id) {
        setPreview((p) =>
          p
            ? {
                ...p,
                rating: saved,
              }
            : p
        );
      }
    } finally {
      setRatingBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Choose AI photo result"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              AI photo results
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Pick a result for this photo crop. Hold Compare to see the
              original.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {error ? (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading results…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No AI results for this crop yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((result) => (
                <li
                  key={result.id}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-white"
                >
                  <ResultThumb
                    result={result}
                    originalUrl={originalUrl}
                    onOpen={() => setPreview(result)}
                  />
                  <div className="space-y-2 border-t border-[var(--border)] px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                          {result.modelLabel}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          <LocalDateTime iso={result.createdAt} />
                        </p>
                      </div>
                      <VoteTotals
                        up={result.modelUpCount}
                        down={result.modelDownCount}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && onRate ? (
                        <>
                          <RateButton
                            kind="up"
                            active={result.rating === "up"}
                            disabled={ratingBusyId === result.id || busy}
                            onClick={() => void toggleRate(result, "up")}
                          />
                          <RateButton
                            kind="down"
                            active={result.rating === "down"}
                            disabled={ratingBusyId === result.id || busy}
                            onClick={() => void toggleRate(result, "down")}
                          />
                        </>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy || applyingId === result.id}
                        onClick={() => void applyResult(result.id)}
                        className="ml-auto rounded-md border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {applyingId === result.id ? "Applying…" : "Use this"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3">
          {photo.replace_background ? (
            <button
              type="button"
              disabled={busy || restoring}
              onClick={() => void restoreOriginal()}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
            >
              {restoring ? "Restoring…" : "Use original"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onRunNew}
            className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
          >
            Run AI again
          </button>
        </div>
      </div>

      {preview?.imageUrl ? (
        <PreviewLightbox
          result={preview}
          originalUrl={originalUrl}
          isAdmin={isAdmin}
          ratingBusy={ratingBusyId === preview.id}
          onRate={
            isAdmin && onRate
              ? (next) => void toggleRate(preview, next)
              : undefined
          }
          onClose={() => setPreview(null)}
          onUse={() => void applyResult(preview.id)}
          applying={applyingId === preview.id}
        />
      ) : null}
    </div>
  );
}

function ResultThumb({
  result,
  originalUrl,
  onOpen,
}: {
  result: AiBackgroundResult;
  originalUrl: string | null;
  onOpen: () => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const src =
    showOriginal && originalUrl
      ? originalUrl
      : (result.imageUrl ?? undefined);

  function holdStart(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setShowOriginal(true);
  }

  function holdEnd(e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setShowOriginal(false);
  }

  return (
    <div className="relative bg-[var(--surface-muted)]">
      <button
        type="button"
        onClick={onOpen}
        title="Enlarge"
        className="block w-full cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={result.modelLabel}
          className="aspect-square w-full object-contain"
          draggable={false}
        />
      </button>
      {originalUrl ? (
        <button
          type="button"
          title="Hold to compare with original"
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerCancel={holdEnd}
          onLostPointerCapture={holdEnd}
          className="absolute bottom-2 right-2 rounded-md border border-[var(--border)] bg-white/90 px-2 py-1 text-xs font-semibold text-[var(--foreground)] shadow-sm"
        >
          {showOriginal ? "Original" : "Compare"}
        </button>
      ) : null}
    </div>
  );
}

function PreviewLightbox({
  result,
  originalUrl,
  isAdmin,
  ratingBusy,
  onRate,
  onClose,
  onUse,
  applying,
}: {
  result: AiBackgroundResult;
  originalUrl: string | null;
  isAdmin: boolean;
  ratingBusy: boolean;
  onRate?: (next: "up" | "down") => void;
  onClose: () => void;
  onUse: () => void;
  applying: boolean;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const src =
    showOriginal && originalUrl ? originalUrl : (result.imageUrl ?? undefined);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--foreground)]">
              {result.modelLabel}
            </p>
            <VoteTotals up={result.modelUpCount} down={result.modelDownCount} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold"
          >
            Close
          </button>
        </div>
        <div className="relative min-h-0 flex-1 bg-[var(--surface-muted)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={result.modelLabel}
            className="mx-auto max-h-[70vh] w-full object-contain"
            draggable={false}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3">
          {originalUrl ? (
            <button
              type="button"
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
            >
              {showOriginal ? "Showing original" : "Hold to compare"}
            </button>
          ) : null}
          {isAdmin && onRate ? (
            <>
              <RateButton
                kind="up"
                active={result.rating === "up"}
                disabled={ratingBusy}
                onClick={() => onRate("up")}
              />
              <RateButton
                kind="down"
                active={result.rating === "down"}
                disabled={ratingBusy}
                onClick={() => onRate("down")}
              />
            </>
          ) : null}
          <button
            type="button"
            disabled={applying}
            onClick={onUse}
            className="ml-auto rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {applying ? "Applying…" : "Use this"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VoteTotals({ up, down }: { up: number; down: number }) {
  if (up <= 0 && down <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums"
      title="All-time totals for this model"
    >
      <span className="text-green-600">+{up}</span>
      <span className="text-red-600">−{down}</span>
    </span>
  );
}

function RateButton({
  kind,
  active,
  disabled,
  onClick,
}: {
  kind: "up" | "down";
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const up = kind === "up";
  return (
    <button
      type="button"
      title={up ? "Thumbs up" : "Thumbs down"}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-40 ${
        active
          ? up
            ? "bg-green-100 text-green-700 ring-1 ring-green-500"
            : "bg-red-100 text-red-700 ring-1 ring-red-500"
          : up
            ? "text-[var(--muted)] hover:bg-green-50 hover:text-green-700"
            : "text-[var(--muted)] hover:bg-red-50 hover:text-red-700"
      }`}
    >
      {up ? <ThumbUpIcon className="h-4 w-4" /> : <ThumbDownIcon className="h-4 w-4" />}
    </button>
  );
}

function LocalDateTime({ iso }: { iso: string }) {
  let text = iso;
  try {
    text = new Date(iso).toLocaleString();
  } catch {
    /* keep */
  }
  return <span suppressHydrationWarning>{text}</span>;
}

function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 7.59 6.59C7.22 6.95 7 7.45 7 8v11c0 1.1.9 2 2 2h7c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M22 3h-4v12h4V3zM2 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L10.83 23l5.58-5.59c.37-.36.59-.86.59-1.41V6c0-1.1-.9-2-2-2H8c-.83 0-1.54.5-1.84 1.22L3.14 12.27c-.09.23-.14.47-.14.73v1z" />
    </svg>
  );
}

/** Sparkle / AI glyph for the listing photo action button. */
export function AiGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l1.2 4.8L18 8l-4.8 1.2L12 14l-1.2-4.8L6 8l4.8-1.2L12 2zm7 9l.8 3.2L23 15l-3.2.8L19 19l-.8-3.2L15 15l3.2-.8L19 11zM5 14l.7 2.8L8.5 17.5 5.7 18.2 5 21l-.7-2.8L1.5 17.5l2.8-.7L5 14z" />
    </svg>
  );
}
