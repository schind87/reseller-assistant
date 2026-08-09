"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { BigButton } from "@/components/BigButton";
import type { FalBgModelDef, FalBgModelId } from "@/lib/ai/fal-bg-models";
import { photoRoleLabel, PLATFORM_LABELS } from "@/lib/platforms";
import type { PhotoRole, Platform } from "@/lib/types";

type AdminPhoto = {
  id: string;
  listing_id: string;
  role: PhotoRole;
  listing_title: string | null;
  listing_platform: Platform;
  owner_email: string | null;
  signedUrl: string | null;
  processedSignedUrl: string | null;
  created_at: string;
  replace_background: boolean;
};

type RunResult = {
  id?: string;
  modelId: string;
  label: string;
  provider: "fal" | "photoroom";
  ok: boolean;
  ms: number;
  imageUrl: string | null;
  error?: string;
  falRequestId?: string | null;
  falDashboardUrl?: string | null;
  costUsd?: number | null;
  costSource?: string | null;
  costLabel?: string | null;
};

type SavedRun = {
  id: string;
  createdAt: string;
  compositeWhite: boolean;
  results: RunResult[];
};

type PreviewImage = {
  src: string;
  label: string;
};

const CHECKERBOARD_STYLE = {
  backgroundImage:
    "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
} as const;

const ROLE_FILTERS: Array<PhotoRole | "all"> = [
  "all",
  "cover",
  "front",
  "back",
  "detail",
  "flaw",
];

type Props = {
  initialPhotos: AdminPhoto[];
  initialTotal: number;
  models: FalBgModelDef[];
  hasFalKey: boolean;
  hasPhotoroomKey: boolean;
};

function formatCost(result: RunResult): string | null {
  if (result.costLabel) return result.costLabel;
  if (result.costUsd == null || Number.isNaN(result.costUsd)) return null;
  if (result.costUsd >= 0.01) return `$${result.costUsd.toFixed(3)}`;
  return `$${result.costUsd.toFixed(5)}`;
}

function costSourceLabel(source: string | null | undefined): string | null {
  switch (source) {
    case "billing":
    case "billing_event":
      return "fal billed";
    case "estimate":
    case "pricing_estimate":
      return "catalog estimate";
    case "catalog_estimate":
      return "catalog estimate";
    case null:
    case undefined:
    case "":
      return null;
    default:
      return source;
  }
}

function formatRunTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AiBgDebugConsole({
  initialPhotos,
  initialTotal,
  models,
  hasFalKey,
  hasPhotoroomKey,
}: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<PhotoRole | "all">("cover");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(
    initialPhotos[0]?.id ?? null,
  );
  const [selectedModels, setSelectedModels] = useState<Set<FalBgModelId>>(
    () => new Set(models.filter((m) => m.defaultSelected).map((m) => m.id)),
  );
  const [compositeWhite, setCompositeWhite] = useState(true);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewImage | null>(null);

  const selectedPhoto =
    photos.find((p) => p.id === selectedPhotoId) ?? photos[0] ?? null;

  function openPreview(src: string | null | undefined, label: string) {
    if (!src) return;
    setPreview({ src, label });
  }

  async function loadHistory(
    photoId: string,
    opts?: { selectLatest?: boolean },
  ) {
    const selectLatest = opts?.selectLatest !== false;
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/admin/bg-debug/run?photoId=${encodeURIComponent(photoId)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load history");
      const runs = (json.runs as SavedRun[]) ?? [];
      startTransition(() => {
        setHistory(runs);
        if (!selectLatest) return;
        if (runs[0]?.results?.length) {
          setResults(runs[0].results);
          setLatestRunId(runs[0].id);
        } else {
          setResults(null);
          setLatestRunId(null);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedPhotoId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/bg-debug/run?photoId=${encodeURIComponent(selectedPhotoId)}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Could not load history");
        const runs = (json.runs as SavedRun[]) ?? [];
        startTransition(() => {
          setHistory(runs);
          if (runs[0]?.results?.length) {
            setResults(runs[0].results);
            setLatestRunId(runs[0].id);
          } else {
            setResults(null);
            setLatestRunId(null);
          }
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load history",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPhotoId]);

  async function loadPhotos(nextRole = role, nextQ = q) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: "48",
        role: nextRole,
      });
      if (nextQ.trim()) params.set("q", nextQ.trim());
      const res = await fetch(`/api/admin/photos?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load photos");
      const list = json.photos as AdminPhoto[];
      startTransition(() => {
        setPhotos(list);
        setTotal(json.total as number);
        setSelectedPhotoId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load photos");
    } finally {
      setLoading(false);
    }
  }

  function toggleModel(id: FalBgModelId) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runModels() {
    if (!selectedPhoto || selectedModels.size === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bg-debug/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: selectedPhoto.id,
          modelIds: [...selectedModels],
          compositeWhite,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Run failed");
      const nextResults = json.results as RunResult[];
      setResults(nextResults);
      setLatestRunId((json.runId as string) ?? null);
      await loadHistory(selectedPhoto.id, { selectLatest: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Admin
          </p>
          <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
            Background model lab
          </h1>
          <p className="mt-2 max-w-2xl text-base text-[var(--muted)]">
            Compare fal.ai (and PhotoRoom) removers on any listing photo.
            Results are saved with per-request cost when fal billing data is
            available.
          </p>
        </div>
        <Link
          href="/app"
          className="text-base font-semibold text-[var(--accent)] hover:underline"
        >
          ← Back to listings
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
            hasFalKey
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-red-50 text-red-800"
          }`}
        >
          FAL_KEY {hasFalKey ? "ready" : "missing"}
        </span>
        <span
          className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${
            hasPhotoroomKey
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-[var(--surface-muted)] text-[var(--muted)]"
          }`}
        >
          PHOTOROOM_API_KEY {hasPhotoroomKey ? "ready" : "optional"}
        </span>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-white p-5">
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              void loadPhotos();
            }}
          >
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by title, email, id…"
              className="touch-target min-w-0 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-base"
            />
            <select
              value={role}
              onChange={(e) => {
                const next = e.target.value as PhotoRole | "all";
                setRole(next);
                void loadPhotos(next, q);
              }}
              aria-label="Photo role"
              className="touch-target w-full min-w-[9.5rem] rounded-xl border border-[var(--border)] bg-white px-3 text-base sm:w-auto"
            >
              {ROLE_FILTERS.map((r) => (
                <option key={r} value={r}>
                  {r === "all" ? "All roles" : photoRoleLabel(r)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="touch-target w-full shrink-0 rounded-xl border border-[var(--border)] px-5 text-base font-semibold hover:bg-[var(--surface-muted)] sm:w-auto"
            >
              Refresh
            </button>
          </form>

          <p className="text-sm text-[var(--muted)]">
            {loading ? "Loading…" : `${photos.length} shown · ${total} total`}
          </p>

          <ul className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto">
            {photos.map((photo) => {
              const active = photo.id === selectedPhoto?.id;
              return (
                <li key={photo.id}>
                  <div
                    className={`overflow-hidden rounded-xl ring-1 transition ${
                      active
                        ? "ring-2 ring-[var(--accent)]"
                        : "ring-[var(--border)]"
                    }`}
                  >
                    <button
                      type="button"
                      title="View full size"
                      onClick={() => {
                        setSelectedPhotoId(photo.id);
                        setResults(null);
                        setLatestRunId(null);
                        openPreview(
                          photo.signedUrl,
                          photo.listing_title || photoRoleLabel(photo.role),
                        );
                      }}
                      className="block w-full cursor-zoom-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.signedUrl ?? undefined}
                        alt=""
                        className="aspect-square w-full bg-[var(--surface-muted)] object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhotoId(photo.id);
                        setResults(null);
                        setLatestRunId(null);
                      }}
                      className="w-full space-y-0.5 px-2.5 py-2 text-left hover:bg-[var(--surface-muted)]"
                    >
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {photoRoleLabel(photo.role)}
                        {photo.replace_background ? " · clean" : ""}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {photo.listing_title ||
                          PLATFORM_LABELS[photo.listing_platform]}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {photo.owner_email || "no email"}
                      </p>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Selected photo
            </h2>
            {selectedPhoto ? (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  title="View full size"
                  onClick={() =>
                    openPreview(
                      selectedPhoto.signedUrl,
                      selectedPhoto.listing_title ||
                        photoRoleLabel(selectedPhoto.role),
                    )
                  }
                  className="cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPhoto.signedUrl ?? undefined}
                    alt=""
                    className="max-h-64 w-full max-w-xs rounded-xl object-contain ring-1 ring-[var(--border)]"
                    style={CHECKERBOARD_STYLE}
                  />
                </button>
                <div className="space-y-2 text-sm text-[var(--muted)]">
                  <p>
                    <span className="font-semibold text-[var(--foreground)]">
                      Role:
                    </span>{" "}
                    {photoRoleLabel(selectedPhoto.role)}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--foreground)]">
                      Listing:
                    </span>{" "}
                    <Link
                      href={`/app/listings/${selectedPhoto.listing_id}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {selectedPhoto.listing_title || selectedPhoto.listing_id}
                    </Link>
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--foreground)]">
                      Owner:
                    </span>{" "}
                    {selectedPhoto.owner_email || "—"}
                  </p>
                  <p className="text-xs">Click the image to view full size.</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[var(--muted)]">Pick a photo to compare.</p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Models
            </h2>
            <ul className="mt-3 space-y-2">
              {models.map((model) => (
                <li key={model.id}>
                  <label
                    className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2 ${
                      selectedModels.has(model.id)
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-white"
                    } ${
                      (model.provider === "fal" && !hasFalKey) ||
                      (model.provider === "photoroom" && !hasPhotoroomKey)
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.has(model.id)}
                      disabled={
                        (model.provider === "fal" && !hasFalKey) ||
                        (model.provider === "photoroom" && !hasPhotoroomKey)
                      }
                      onChange={() => toggleModel(model.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">
                        {model.label}{" "}
                        <span className="font-normal text-[var(--muted)]">
                          ({model.approxCost})
                        </span>
                      </span>
                      <span className="block text-xs leading-relaxed text-[var(--muted)]">
                        {model.description}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <label className="mt-4 flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={compositeWhite}
                onChange={(e) => setCompositeWhite(e.target.checked)}
              />
              Composite transparent cutouts onto white for comparison
            </label>

            <div className="mt-4 max-w-sm">
              <BigButton
                disabled={
                  running || !selectedPhoto || selectedModels.size === 0
                }
                onClick={() => void runModels()}
              >
                {running
                  ? "Running models…"
                  : `Run ${selectedModels.size} model${selectedModels.size === 1 ? "" : "s"}`}
              </BigButton>
            </div>
          </div>

          {selectedPhoto ? (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Saved runs
                </h2>
                {historyLoading ? (
                  <span className="text-sm text-[var(--muted)]">Loading…</span>
                ) : (
                  <span className="text-sm text-[var(--muted)]">
                    {history.length} saved
                  </span>
                )}
              </div>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  No saved comparisons for this photo yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {history.map((run) => {
                    const active = run.id === latestRunId;
                    const billed = run.results.reduce(
                      (sum, r) => sum + (r.costUsd ?? 0),
                      0,
                    );
                    return (
                      <li key={run.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setLatestRunId(run.id);
                            setResults(run.results);
                          }}
                          className={`w-full rounded-xl border px-3 py-2 text-left ${
                            active
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                              : "border-[var(--border)] hover:bg-[var(--surface-muted)]"
                          }`}
                        >
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {formatRunTime(run.createdAt)}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {run.results.length} model
                            {run.results.length === 1 ? "" : "s"}
                            {billed > 0
                              ? ` · ~$${billed.toFixed(3)} total`
                              : ""}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {results ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Results
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => {
              const cost = formatCost(result);
              const source = costSourceLabel(result.costSource);
              return (
                <article
                  key={`${result.modelId}-${result.id ?? result.ms}`}
                  className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]"
                >
                  <div className="border-b border-[var(--border)] px-3 py-2">
                    <p className="font-semibold text-[var(--foreground)]">
                      {result.label}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {result.provider} · {result.ms}ms
                      {result.ok ? "" : " · failed"}
                      {cost ? ` · ${cost}` : ""}
                      {source ? ` (${source})` : ""}
                    </p>
                    {result.falDashboardUrl ? (
                      <a
                        href={result.falDashboardUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        fal request →
                      </a>
                    ) : null}
                  </div>
                  {result.ok && result.imageUrl ? (
                    <button
                      type="button"
                      title="View full size"
                      onClick={() => openPreview(result.imageUrl, result.label)}
                      className="block w-full cursor-zoom-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.imageUrl}
                        alt={result.label}
                        className="aspect-square w-full object-contain"
                        style={CHECKERBOARD_STYLE}
                      />
                    </button>
                  ) : (
                    <p className="bg-red-50 px-3 py-6 text-sm text-red-800">
                      {result.error || "No image"}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {preview ? (
        <ImageLightbox
          src={preview.src}
          label={preview.label}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

function ImageLightbox({
  src,
  label,
  onClose,
}: {
  src: string;
  label: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 touch-target rounded-xl bg-white/95 px-4 text-base font-semibold text-[var(--foreground)]"
      >
        Close
      </button>
      <div
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="max-h-[min(90vh,1100px)] max-w-[min(96vw,1100px)] rounded-lg object-contain shadow-2xl"
          style={CHECKERBOARD_STYLE}
        />
        <p className="rounded-lg bg-black/50 px-3 py-1 text-sm font-medium text-white">
          {label}
        </p>
      </div>
    </div>
  );
}
