"use client";

import { startTransition, useEffect, useMemo, useState, type CSSProperties } from "react";
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
  runId?: string;
  modelId: string;
  label: string;
  provider: "fal" | "photoroom";
  ok: boolean;
  ms: number;
  imageUrl: string | null;
  error?: string;
  falRequestId?: string | null;
  falEndpoint?: string | null;
  falDashboardUrl?: string | null;
  costUsd?: number | null;
  costUnitPrice?: number | null;
  costUnits?: number | null;
  costSource?: string | null;
  costLabel?: string | null;
  createdAt?: string;
};

type SavedRun = {
  id: string;
  createdAt: string;
  compositeWhite: boolean;
  results: RunResult[];
};

type ModelHistory = {
  modelId: string;
  label: string;
  versions: RunResult[];
};

type RecentRunSummary = {
  id: string;
  createdAt: string;
  photoId: string;
  listingId: string;
  photoRole: string | null;
  listingTitle: string | null;
  listingPlatform: string | null;
  resultCount: number;
  okCount: number;
  modelLabels: string[];
  thumbUrl: string | null;
};

type PreviewImage = {
  src: string;
  label: string;
};

type LabBackdrop = "white" | "dark";

const LAB_BACKDROP_CSS: Record<LabBackdrop, string> = {
  white: "#ffffff",
  dark: "#3f3f46",
};

const CHECKERBOARD_STYLE = {
  backgroundImage:
    "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
} as const;

function resultBackdropStyle(backdrop: LabBackdrop): CSSProperties {
  return {
    backgroundColor: LAB_BACKDROP_CSS[backdrop],
  };
}

const ROLE_FILTERS: Array<PhotoRole | "all"> = [
  "all",
  "cover",
  "front",
  "back",
  "detail",
  "tag",
  "flaw",
];

type Props = {
  initialPhotos: AdminPhoto[];
  initialTotal: number;
  initialRecentRuns?: RecentRunSummary[];
  models: FalBgModelDef[];
  hasFalKey: boolean;
};

function formatCostUsd(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value === 0) return "$0";
  // Always 4 significant figures (e.g. $0.01600, $0.02400).
  const precision = Math.abs(value).toPrecision(4);
  const signed = value < 0 ? `-${precision}` : precision;
  return `$${signed}`;
}

function formatDurationSeconds(ms: number): string {
  const seconds = ms / 1000;
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  return `${seconds.toFixed(1)}s`;
}

function costSourceLabel(source: string | null | undefined): string | null {
  switch (source) {
    case "billing":
    case "billing_event":
      return "actual";
    case "estimate":
    case "pricing_estimate":
    case "catalog_estimate":
      return "estimate";
    case null:
    case undefined:
    case "":
      return null;
    default:
      return source;
  }
}

function CostBadge({
  result,
  size = "md",
}: {
  result: RunResult;
  size?: "sm" | "md";
}) {
  const cost = formatCostUsd(result.costUsd);
  const source = costSourceLabel(result.costSource);
  if (!cost) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-dashed border-[var(--border)] bg-white/90 font-semibold text-[var(--muted)] ${
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
        }`}
        title="fal billing API returned no amount yet (needs an ADMIN-scoped key for actual costs — see Recent History link)"
      >
        Cost pending
      </span>
    );
  }
  const isActual = source === "actual";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold tabular-nums shadow-sm ${
        isActual
          ? "bg-[var(--accent)] text-white"
          : "bg-amber-100 text-amber-950 ring-1 ring-amber-200"
      } ${size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-sm"}`}
      title={
        isActual
          ? "Actual amount charged by fal for this request"
          : "Catalog unit price estimate — refresh for actual billing"
      }
    >
      {cost}
      <span className="font-semibold opacity-80">
        {isActual ? "actual" : "est."}
      </span>
    </span>
  );
}

function LocalDateTime({
  iso,
  className,
}: {
  iso: string | undefined;
  className?: string;
}) {
  if (!iso) return null;
  let text = iso;
  try {
    text = new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    /* keep iso */
  }
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

/** Newest-first history for each model across all saved runs for a photo. */
function buildModelHistories(runs: SavedRun[]): ModelHistory[] {
  const byModel = new Map<string, ModelHistory>();

  for (const run of runs) {
    for (const result of run.results) {
      const existing = byModel.get(result.modelId);
      const withMeta: RunResult = {
        ...result,
        runId: result.runId ?? run.id,
        createdAt: result.createdAt ?? run.createdAt,
      };
      if (existing) {
        existing.versions.push(withMeta);
      } else {
        byModel.set(result.modelId, {
          modelId: result.modelId,
          label: result.label,
          versions: [withMeta],
        });
      }
    }
  }

  for (const entry of byModel.values()) {
    entry.versions.sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });
  }

  return [...byModel.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export function AiBgDebugConsole({
  initialPhotos,
  initialTotal,
  initialRecentRuns = [],
  models,
  hasFalKey,
}: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<PhotoRole | "all">("all");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(
    initialPhotos[0]?.id ?? null,
  );
  const [selectedModels, setSelectedModels] = useState<Set<FalBgModelId>>(
    () => new Set(models.filter((m) => m.defaultSelected).map((m) => m.id)),
  );
  const [labBackdrop, setLabBackdrop] = useState<LabBackdrop>("white");
  const [history, setHistory] = useState<SavedRun[]>([]);
  const [recentRuns, setRecentRuns] =
    useState<RecentRunSummary[]>(initialRecentRuns);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshingCosts, setRefreshingCosts] = useState(false);
  const [runProgress, setRunProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [pendingModelIds, setPendingModelIds] = useState<FalBgModelId[]>([]);
  const [freshModelIds, setFreshModelIds] = useState<Set<string>>(
    () => new Set(),
  );
  /** Index into each model's saved versions (0 = newest). */
  const [versionIndexByModel, setVersionIndexByModel] = useState<
    Record<string, number>
  >({});
  const [preview, setPreview] = useState<PreviewImage | null>(null);

  const selectedPhoto =
    photos.find((p) => p.id === selectedPhotoId) ?? photos[0] ?? null;

  const modelHistories = useMemo(
    () => buildModelHistories(history),
    [history],
  );

  const savedCountByModel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of modelHistories) {
      counts.set(entry.modelId, entry.versions.length);
    }
    return counts;
  }, [modelHistories]);

  function openPreview(src: string | null | undefined, label: string) {
    if (!src) return;
    setPreview({ src, label });
  }

  function applyHistory(runs: SavedRun[], preferLatest = true) {
    setHistory(runs);
    if (!preferLatest) return;
    const nextIndexes: Record<string, number> = {};
    for (const entry of buildModelHistories(runs)) {
      nextIndexes[entry.modelId] = 0;
    }
    setVersionIndexByModel(nextIndexes);
  }

  async function loadHistory(photoId: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/admin/bg-debug/run?photoId=${encodeURIComponent(photoId)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load history");
      const runs = (json.runs as SavedRun[]) ?? [];
      const recent = (json.recentRuns as RecentRunSummary[]) ?? [];
      startTransition(() => {
        applyHistory(runs, true);
        setRecentRuns(recent);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadRecentRuns() {
    try {
      const res = await fetch("/api/admin/bg-debug/run?recent=1");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load recent runs");
      startTransition(() => {
        setRecentRuns((json.recentRuns as RecentRunSummary[]) ?? []);
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load recent runs",
      );
    }
  }

  useEffect(() => {
    if (!selectedPhotoId || running) return;
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
        const recent = (json.recentRuns as RecentRunSummary[]) ?? [];
        startTransition(() => {
          applyHistory(runs, true);
          setRecentRuns(recent);
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
  }, [selectedPhotoId, running]);

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

  function stepVersion(modelId: string, delta: number, totalVersions: number) {
    setVersionIndexByModel((prev) => {
      const current = prev[modelId] ?? 0;
      const next = Math.min(
        Math.max(current + delta, 0),
        Math.max(totalVersions - 1, 0),
      );
      return { ...prev, [modelId]: next };
    });
  }

  async function openRecentRun(run: RecentRunSummary) {
    setError(null);
    setSelectedPhotoId(run.photoId);
    // Ensure the photo is in the list even if the current filter hid it.
    if (!photos.some((p) => p.id === run.photoId)) {
      try {
        const params = new URLSearchParams({
          limit: "48",
          role: "all",
          q: run.listingTitle ?? "",
        });
        const res = await fetch(`/api/admin/photos?${params}`);
        const json = await res.json();
        if (res.ok) {
          const list = (json.photos as AdminPhoto[]) ?? [];
          startTransition(() => {
            setRole("all");
            setPhotos((prev) => {
              const byId = new Map(prev.map((p) => [p.id, p]));
              for (const photo of list) byId.set(photo.id, photo);
              return [...byId.values()];
            });
            setTotal(json.total ?? list.length);
          });
        }
      } catch {
        /* history load for photoId still proceeds */
      }
    }
    await loadHistory(run.photoId);
  }

  async function runModels() {
    if (!selectedPhoto || selectedModels.size === 0) return;
    const modelIds = [...selectedModels] as FalBgModelId[];
    const total = modelIds.length;
    setRunning(true);
    setError(null);
    setRunProgress({ completed: 0, total });
    setPendingModelIds(modelIds);
    setFreshModelIds(new Set());

    const appendResult = (runId: string, result: RunResult) => {
      setHistory((prev) => {
        const idx = prev.findIndex((r) => r.id === runId);
        if (idx === -1) {
          return [
            {
              id: runId,
              createdAt: result.createdAt ?? new Date().toISOString(),
              compositeWhite: false,
              results: [result],
            },
            ...prev,
          ];
        }
        const next = [...prev];
        const existing = next[idx];
        const withoutDup = existing.results.filter(
          (r) => r.modelId !== result.modelId,
        );
        next[idx] = {
          ...existing,
          results: [...withoutDup, result],
        };
        return next;
      });
      setVersionIndexByModel((prev) => ({ ...prev, [result.modelId]: 0 }));
      setPendingModelIds((prev) =>
        prev.filter((id) => id !== result.modelId),
      );
      setFreshModelIds((prev) => {
        const next = new Set(prev);
        next.add(result.modelId);
        return next;
      });
    };

    const patchCost = (
      runId: string,
      modelId: string,
      patch: Partial<RunResult>,
    ) => {
      setHistory((prev) =>
        prev.map((run) => {
          if (run.id !== runId) return run;
          return {
            ...run,
            results: run.results.map((r) =>
              r.modelId === modelId ? { ...r, ...patch } : r,
            ),
          };
        }),
      );
    };

    try {
      const res = await fetch("/api/admin/bg-debug/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: selectedPhoto.id,
          modelIds,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "Run failed");
      }

      if (!contentType.includes("ndjson") || !res.body) {
        // Legacy JSON fallback
        const json = await res.json();
        await loadHistory(selectedPhoto.id);
        if (json.error) throw new Error(json.error);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: {
            type?: string;
            runId?: string;
            completed?: number;
            total?: number;
            error?: string;
            result?: RunResult & {
              costCurrency?: string | null;
            };
          };
          try {
            event = JSON.parse(trimmed) as typeof event;
          } catch {
            continue;
          }

          switch (event.type) {
            case "start":
              if (typeof event.total === "number") {
                setRunProgress({ completed: 0, total: event.total });
              }
              break;
            case "result":
              if (event.result && event.runId) {
                appendResult(event.runId, event.result);
              }
              if (
                typeof event.completed === "number" &&
                typeof event.total === "number"
              ) {
                setRunProgress({
                  completed: event.completed,
                  total: event.total,
                });
              }
              break;
            case "cost":
              if (event.runId && event.result?.modelId) {
                patchCost(event.runId, event.result.modelId, {
                  costUsd: event.result.costUsd,
                  costUnitPrice: event.result.costUnitPrice,
                  costUnits: event.result.costUnits,
                  costSource: event.result.costSource,
                  falDashboardUrl: event.result.falDashboardUrl,
                  costLabel: event.result.costLabel,
                });
              }
              break;
            case "error":
              throw new Error(event.error ?? "Run failed");
            case "done":
              break;
            default:
              break;
          }
        }
      }

      await loadRecentRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
      setRunProgress(null);
      setPendingModelIds([]);
      // Keep fresh highlights briefly until user starts another run / leaves.
    }
  }

  async function refreshCosts() {
    if (!selectedPhoto) return;
    setRefreshingCosts(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bg-debug/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: selectedPhoto.id,
          refreshCosts: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not refresh costs");
      const runs = (json.runs as SavedRun[]) ?? [];
      startTransition(() => {
        applyHistory(runs, false);
      });
      await loadRecentRuns();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not refresh costs",
      );
    } finally {
      setRefreshingCosts(false);
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
            Compare fal.ai removers on any listing photo. Each model&apos;s past
            runs are saved per photo so you can flip versions without calling
            fal again.
          </p>
        </div>
        <Link
          href="/app"
          className="text-base font-semibold text-[var(--accent)] hover:underline"
        >
          ← Back to listings
        </Link>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Your recent runs
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Every comparison you&apos;ve run in the lab. Tap one to reopen that
              photo and its saved results.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRecentRuns()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          >
            Refresh list
          </button>
        </div>
        {recentRuns.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No lab runs yet. Pick a photo below and run one or more models.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentRuns.map((run) => {
              const active = selectedPhotoId === run.photoId;
              const when = run.createdAt;
              const roleLabel = run.photoRole
                ? photoRoleLabel(run.photoRole as PhotoRole)
                : "Photo";
              const platform =
                run.listingPlatform &&
                run.listingPlatform in PLATFORM_LABELS
                  ? PLATFORM_LABELS[run.listingPlatform as Platform]
                  : run.listingPlatform;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => void openRecentRun(run)}
                    className={`flex w-full gap-3 rounded-xl border p-2.5 text-left transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <div
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--border)]"
                      style={resultBackdropStyle(labBackdrop)}
                    >
                      {run.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={run.thumbUrl}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-[var(--muted)]">
                          No thumb
                        </div>
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                        {run.listingTitle || platform || "Listing"}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {roleLabel} · {run.okCount}/{run.resultCount} ok
                        {when ? (
                          <>
                            {" · "}
                            <LocalDateTime iso={when} />
                          </>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                        {run.modelLabels.join(", ") || "No models"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
              const previewLabel =
                photo.listing_title || photoRoleLabel(photo.role);
              return (
                <li key={photo.id}>
                  <div
                    className={`overflow-hidden rounded-xl border-2 bg-white transition ${
                      active
                        ? "border-[var(--accent)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPhotoId(photo.id);
                        }}
                        className="block w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.signedUrl ?? undefined}
                          alt=""
                          className="aspect-square w-full bg-[var(--surface-muted)] object-cover"
                        />
                      </button>
                      <MagnifyButton
                        disabled={!photo.signedUrl}
                        onClick={() =>
                          openPreview(photo.signedUrl, previewLabel)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhotoId(photo.id);
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
                <div className="relative w-full max-w-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPhoto.signedUrl ?? undefined}
                    alt=""
                    className="max-h-64 w-full rounded-xl object-contain ring-1 ring-[var(--border)]"
                    style={CHECKERBOARD_STYLE}
                  />
                  <MagnifyButton
                    disabled={!selectedPhoto.signedUrl}
                    onClick={() =>
                      openPreview(
                        selectedPhoto.signedUrl,
                        selectedPhoto.listing_title ||
                          photoRoleLabel(selectedPhoto.role),
                      )
                    }
                  />
                </div>
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
                  <p className="text-xs">
                    {historyLoading
                      ? "Loading saved model results…"
                      : modelHistories.length > 0
                        ? `${modelHistories.length} model${modelHistories.length === 1 ? "" : "s"} saved for this photo`
                        : "No saved model results yet for this photo."}
                  </p>
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
              {models.map((model) => {
                const savedCount = savedCountByModel.get(model.id) ?? 0;
                return (
                  <li key={model.id}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2 ${
                        selectedModels.has(model.id)
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-white"
                      } ${!hasFalKey ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModels.has(model.id)}
                        disabled={!hasFalKey}
                        onChange={() => toggleModel(model.id)}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--foreground)]">
                          {model.label}{" "}
                          <span className="font-normal text-[var(--muted)]">
                            ({model.approxCost})
                          </span>
                          {savedCount > 0 ? (
                            <span className="ml-2 font-normal text-[var(--accent)]">
                              · {savedCount} saved
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs leading-relaxed text-[var(--muted)]">
                          {model.description}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Edge review backdrop
              </p>
              <p className="text-xs text-[var(--muted)]">
                Display-only — results stay transparent. Dark grey makes soft
                edges easier to see.
              </p>
              <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
                {(
                  [
                    { id: "white", label: "White" },
                    { id: "dark", label: "Dark grey" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setLabBackdrop(option.id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                      labBackdrop === option.id
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 max-w-sm">
              <BigButton
                disabled={
                  running || !selectedPhoto || selectedModels.size === 0
                }
                onClick={() => void runModels()}
              >
                {running && runProgress
                  ? `Running ${runProgress.completed}/${runProgress.total}…`
                  : running
                    ? "Running…"
                    : `Run ${selectedModels.size} model${selectedModels.size === 1 ? "" : "s"}`}
              </BigButton>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Run calls fal and appends a new saved version. Switching photos or
              flipping versions below only loads stored results.
            </p>
          </div>
        </div>
      </section>

      {selectedPhoto ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Saved results by model
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Flip older/newer versions per model without re-running. Cost
                badges show fal&apos;s actual billed amount when available.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
                {(
                  [
                    { id: "white", label: "White" },
                    { id: "dark", label: "Dark grey" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setLabBackdrop(option.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      labBackdrop === option.id
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {historyLoading ? (
                <span className="text-sm text-[var(--muted)]">Loading…</span>
              ) : null}
              <button
                type="button"
                disabled={
                  !selectedPhoto ||
                  refreshingCosts ||
                  historyLoading ||
                  modelHistories.length === 0
                }
                onClick={() => void refreshCosts()}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] disabled:opacity-40"
              >
                {refreshingCosts ? "Refreshing costs…" : "Refresh costs"}
              </button>
            </div>
          </div>

          {modelHistories.length === 0 &&
          pendingModelIds.length === 0 &&
          !historyLoading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No saved comparisons for this photo yet. Select models and run
              once to start building history.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingModelIds.map((modelId) => {
                const model = models.find((m) => m.id === modelId);
                const label = model?.label ?? modelId;
                return (
                  <article
                    key={`pending-${modelId}`}
                    className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]"
                  >
                    <div className="border-b border-[var(--border)] px-3 py-2">
                      <p className="font-semibold text-[var(--foreground)]">
                        {label}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Running…
                        {runProgress
                          ? ` · ${runProgress.completed}/${runProgress.total} done`
                          : ""}
                      </p>
                    </div>
                    <div
                      className="flex aspect-square w-full items-center justify-center"
                      style={resultBackdropStyle(labBackdrop)}
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]"
                          aria-hidden
                        />
                        Waiting for result
                      </span>
                    </div>
                  </article>
                );
              })}
              {modelHistories.map((entry) => {
                const index = Math.min(
                  versionIndexByModel[entry.modelId] ?? 0,
                  entry.versions.length - 1,
                );
                const result = entry.versions[index];
                if (!result) return null;
                const canNewer = index > 0;
                const canOlder = index < entry.versions.length - 1;
                const isFresh = freshModelIds.has(entry.modelId);

                return (
                  <article
                    key={entry.modelId}
                    className={`overflow-hidden rounded-xl ring-1 ${
                      isFresh
                        ? "ring-[var(--accent)]"
                        : "ring-[var(--border)]"
                    }`}
                  >
                    <div className="border-b border-[var(--border)] px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[var(--foreground)]">
                          {entry.label}
                          {isFresh ? (
                            <span className="ml-2 text-xs font-semibold text-[var(--accent)]">
                              just in
                            </span>
                          ) : null}
                        </p>
                        <CostBadge result={result} />
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {result.provider} · {formatDurationSeconds(result.ms)}
                        {result.ok ? "" : " · failed"}
                        {result.costUnits != null &&
                        result.costUnitPrice != null
                          ? ` · ${result.costUnits} × ${formatCostUsd(Number(result.costUnitPrice)) ?? ""}`
                          : ""}
                      </p>
                      {result.createdAt ? (
                        <p className="text-xs text-[var(--muted)]">
                          <LocalDateTime iso={result.createdAt} />
                        </p>
                      ) : null}
                      <FalRequestMeta result={result} />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={!canNewer || running}
                          onClick={() =>
                            stepVersion(entry.modelId, -1, entry.versions.length)
                          }
                          className="touch-target rounded-lg border border-[var(--border)] px-2.5 text-sm font-semibold disabled:opacity-40"
                        >
                          ← Newer
                        </button>
                        <span className="text-xs text-[var(--muted)]">
                          {index + 1} / {entry.versions.length}
                        </span>
                        <button
                          type="button"
                          disabled={!canOlder || running}
                          onClick={() =>
                            stepVersion(entry.modelId, 1, entry.versions.length)
                          }
                          className="touch-target rounded-lg border border-[var(--border)] px-2.5 text-sm font-semibold disabled:opacity-40"
                        >
                          Older →
                        </button>
                      </div>
                    </div>
                    {result.ok && result.imageUrl ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={result.imageUrl}
                          alt={entry.label}
                          className="aspect-square w-full object-contain"
                          style={resultBackdropStyle(labBackdrop)}
                        />
                        <div className="pointer-events-none absolute left-2 top-2 z-10">
                          <CostBadge result={result} size="sm" />
                        </div>
                        <MagnifyButton
                          onClick={() =>
                            openPreview(result.imageUrl, entry.label)
                          }
                        />
                      </div>
                    ) : (
                      <p className="bg-red-50 px-3 py-6 text-sm text-red-800">
                        {result.error || "No image"}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {preview ? (
        <ImageLightbox
          src={preview.src}
          label={preview.label}
          backdrop={labBackdrop}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

function FalRequestMeta({ result }: { result: RunResult }) {
  const requestId = result.falRequestId?.trim() || null;
  const realId =
    Boolean(requestId) && !requestId!.startsWith("sync-") ? requestId : null;
  const href = result.falDashboardUrl;

  if (!href && !realId) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[var(--accent)] hover:underline"
          title="Opens this request in fal Recent History (includes billed cost when available)"
        >
          fal request →
        </a>
      ) : null}
      {realId ? (
        <button
          type="button"
          className="font-semibold text-[var(--muted)] hover:text-[var(--foreground)] hover:underline"
          title={realId}
          onClick={() => {
            void navigator.clipboard.writeText(realId);
          }}
        >
          Copy request id
        </button>
      ) : null}
    </div>
  );
}

function MagnifyButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title="Enlarge"
      aria-label="Enlarge photo"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-[1px] transition hover:bg-black/60 disabled:pointer-events-none disabled:opacity-40"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M16 16l4.5 4.5" />
        <path d="M10.5 8v5" />
        <path d="M8 10.5h5" />
      </svg>
    </button>
  );
}

function ImageLightbox({
  src,
  label,
  backdrop = "white",
  onClose,
}: {
  src: string;
  label: string;
  backdrop?: LabBackdrop;
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
          style={resultBackdropStyle(backdrop)}
        />
        <p className="rounded-lg bg-black/50 px-3 py-1 text-sm font-medium text-white">
          {label}
        </p>
      </div>
    </div>
  );
}
