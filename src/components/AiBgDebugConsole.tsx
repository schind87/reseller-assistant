"use client";

import { startTransition, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { BigButton } from "@/components/BigButton";
import type { FalBgModelDef, FalBgModelId } from "@/lib/ai/fal-bg-models";
import { parseApproxCostUsd } from "@/lib/ai/fal-lab";
import {
  EMPTY_BG_MODEL_CATALOG_PREFS,
  descopedModelIdSet,
  readBgModelCatalogPrefs,
  resolveDefaultListingModelId,
  scopedBgModels,
  subscribeBgModelCatalogPrefs,
  writeBgModelCatalogPrefs,
} from "@/lib/ai/bg-model-prefs";
import { photoRoleLabel, PLATFORM_LABELS } from "@/lib/platforms";
import {
  isIdentifyPhotoRole,
  type PhotoRole,
  type Platform,
} from "@/lib/types";

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
  rating?: "up" | "down" | null;
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

type ModelCostAverage = {
  modelId: string;
  avgUsd: number;
  sampleCount: number;
};

type ModelRatingStats = {
  modelId: string;
  upCount: number;
  downCount: number;
};

type PreviewImage = {
  src: string;
  label: string;
  originalUrl?: string | null;
  /** Present when previewing a lab model result. */
  result?: RunResult | null;
  costScale?: number | null;
  isCheapest?: boolean;
  /** Present when previewing a source listing photo. */
  photoMeta?: {
    role: string;
    listingTitle: string | null;
    platform: string;
    ownerEmail: string | null;
  } | null;
};

type PreviewState = {
  items: PreviewImage[];
  index: number;
};

type LabBackdrop = "white" | "dark";

const LAB_PREFS_KEY = "ra-bg-lab-prefs-v1";

type StoredLabPrefs = {
  selectedModels?: string[];
  labBackdrop?: LabBackdrop;
};

const EMPTY_LAB_PREFS: StoredLabPrefs = Object.freeze({});

let cachedLabPrefsRaw: string | null | undefined;
let cachedLabPrefs: StoredLabPrefs = EMPTY_LAB_PREFS;

function readStoredLabPrefs(): StoredLabPrefs {
  try {
    const raw = window.localStorage.getItem(LAB_PREFS_KEY);
    if (raw === cachedLabPrefsRaw) return cachedLabPrefs;
    cachedLabPrefsRaw = raw;
    if (!raw) {
      cachedLabPrefs = EMPTY_LAB_PREFS;
      return cachedLabPrefs;
    }
    const parsed = JSON.parse(raw) as StoredLabPrefs;
    cachedLabPrefs =
      parsed && typeof parsed === "object" ? parsed : EMPTY_LAB_PREFS;
    return cachedLabPrefs;
  } catch {
    return EMPTY_LAB_PREFS;
  }
}

function writeStoredLabPrefs(patch: StoredLabPrefs) {
  try {
    const next = { ...readStoredLabPrefs(), ...patch };
    const raw = JSON.stringify(next);
    window.localStorage.setItem(LAB_PREFS_KEY, raw);
    cachedLabPrefsRaw = raw;
    cachedLabPrefs = next;
    window.dispatchEvent(new Event("ra-bg-lab-prefs"));
  } catch {
    /* ignore quota / private mode */
  }
}

function subscribeLabPrefs(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("ra-bg-lab-prefs", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("ra-bg-lab-prefs", onStoreChange);
  };
}

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
  initialModelCostAverages?: ModelCostAverage[];
  initialModelRatingStats?: ModelRatingStats[];
  initialSelectedPhotoId?: string | null;
  initialListingFilter?: string | null;
  /** Saved AI result image counts keyed by listing photo id. */
  initialSavedResultCounts?: Record<string, number>;
  models: FalBgModelDef[];
  hasFalKey: boolean;
};

function formatCostUsd(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  // Display as cents with one decimal (e.g. $0.016 → 1.6¢).
  const cents = value * 100;
  const rounded = Math.round(cents * 10) / 10;
  const body = Math.abs(rounded).toFixed(1);
  return `${rounded < 0 ? "-" : ""}${body}¢`;
}

/** Catalog approxCost strings normalized to cents (or "unpriced"). */
function formatApproxCostCents(approxCost: string): string {
  const usd = parseApproxCostUsd(approxCost);
  return formatCostUsd(usd) ?? "unpriced";
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

function costScaleStyles(
  scale: number,
  isActual: boolean,
): { backgroundColor: string; color: string; boxShadow?: string } {
  const t = Math.min(1, Math.max(0, scale));
  // 0 = cheapest (green), 1 = most expensive (red)
  const hue = 120 * (1 - t);
  if (isActual) {
    return {
      backgroundColor: `hsl(${hue} 62% 38%)`,
      color: "#ffffff",
    };
  }
  return {
    backgroundColor: `hsl(${hue} 72% 90%)`,
    color: `hsl(${hue} 60% 26%)`,
    boxShadow: `inset 0 0 0 1px hsl(${hue} 45% 72%)`,
  };
}

function CostBadge({
  result,
  size = "md",
  costScale = null,
}: {
  result: RunResult;
  size?: "sm" | "md";
  /** 0 = cheapest in run (green), 1 = most expensive (red). */
  costScale?: number | null;
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
  const scaleStyles =
    costScale != null ? costScaleStyles(costScale, isActual) : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold tabular-nums shadow-sm ${
        scaleStyles
          ? ""
          : isActual
            ? "bg-[var(--accent)] text-white"
            : "bg-amber-100 text-amber-950 ring-1 ring-amber-200"
      } ${size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-sm"}`}
      style={scaleStyles ?? undefined}
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
  initialModelCostAverages = [],
  initialModelRatingStats = [],
  initialSelectedPhotoId = null,
  initialListingFilter = null,
  initialSavedResultCounts = {},
  models,
  hasFalKey,
}: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [total, setTotal] = useState(initialTotal);
  const [savedResultCounts, setSavedResultCounts] = useState<
    Record<string, number>
  >(initialSavedResultCounts);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(initialListingFilter ?? "");
  const [role, setRole] = useState<PhotoRole | "all">("all");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(
    initialSelectedPhotoId &&
      initialPhotos.some((p) => p.id === initialSelectedPhotoId)
      ? initialSelectedPhotoId
      : (initialPhotos[0]?.id ?? null),
  );
  /** When set, highlight that recent-run card and show only its results. */
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const storedPrefs = useSyncExternalStore(
    subscribeLabPrefs,
    readStoredLabPrefs,
    () => EMPTY_LAB_PREFS,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const catalogPrefs = useSyncExternalStore(
    subscribeBgModelCatalogPrefs,
    readBgModelCatalogPrefs,
    () => EMPTY_BG_MODEL_CATALOG_PREFS,
  );
  const descopedIds = useMemo(
    () => descopedModelIdSet(catalogPrefs),
    [catalogPrefs],
  );
  const selectableModels = useMemo(
    () => scopedBgModels(models, catalogPrefs),
    [models, catalogPrefs],
  );
  const defaultListingModelId = useMemo(
    () => resolveDefaultListingModelId(catalogPrefs, models),
    [catalogPrefs, models],
  );
  const defaultSelectedModels = useMemo(
    () =>
      new Set(
        selectableModels.filter((m) => m.defaultSelected).map((m) => m.id),
      ),
    [selectableModels],
  );
  const rememberedModels = useMemo(() => {
    const known = new Set(selectableModels.map((m) => m.id));
    const ids = (storedPrefs.selectedModels ?? []).filter((id): id is FalBgModelId =>
      known.has(id as FalBgModelId),
    );
    return ids.length > 0 ? new Set(ids) : null;
  }, [selectableModels, storedPrefs.selectedModels]);
  const [sessionModels, setSessionModels] = useState<Set<FalBgModelId> | null>(
    null,
  );
  const selectedModelsRaw =
    sessionModels ?? rememberedModels ?? defaultSelectedModels;
  const selectedModels = useMemo(() => {
    const next = new Set<FalBgModelId>();
    for (const id of selectedModelsRaw) {
      if (!descopedIds.has(id)) next.add(id);
    }
    return next;
  }, [selectedModelsRaw, descopedIds]);
  const labBackdrop: LabBackdrop =
    storedPrefs.labBackdrop === "dark" || storedPrefs.labBackdrop === "white"
      ? storedPrefs.labBackdrop
      : "white";
  const [history, setHistory] = useState<SavedRun[]>([]);
  const [recentRuns, setRecentRuns] =
    useState<RecentRunSummary[]>(initialRecentRuns);
  const [modelCostAverages, setModelCostAverages] = useState<
    ModelCostAverage[]
  >(initialModelCostAverages);
  const [modelRatingStats, setModelRatingStats] = useState<ModelRatingStats[]>(
    initialModelRatingStats,
  );
  const [ratingBusyId, setRatingBusyId] = useState<string | null>(null);
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
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const selectedPhoto =
    photos.find((p) => p.id === selectedPhotoId) ?? photos[0] ?? null;

  const modelHistories = useMemo(() => {
    if (selectedRunId == null) return buildModelHistories(history);
    return buildModelHistories(
      history.filter((run) => run.id === selectedRunId),
    );
  }, [history, selectedRunId]);

  const selectedRecentRun = useMemo(
    () =>
      selectedRunId
        ? (recentRuns.find((run) => run.id === selectedRunId) ?? null)
        : null,
    [recentRuns, selectedRunId],
  );

  /** Per-model cost rank in the currently shown run(s): 0 cheap → 1 expensive. */
  const costScaleByModelId = useMemo(() => {
    const byRun = new Map<string, { modelId: string; cost: number }[]>();
    for (const entry of modelHistories) {
      const index = Math.min(
        versionIndexByModel[entry.modelId] ?? 0,
        entry.versions.length - 1,
      );
      const result = entry.versions[index];
      if (!result?.ok) continue;
      const cost = result.costUsd;
      if (typeof cost !== "number" || !Number.isFinite(cost)) continue;
      const runId = result.runId ?? "unknown";
      const list = byRun.get(runId) ?? [];
      list.push({ modelId: entry.modelId, cost });
      byRun.set(runId, list);
    }
    const scales = new Map<string, number>();
    const winners = new Set<string>();
    // Wait until every model in the live batch finishes before crowning
    // cheapest — otherwise the badge jumps as partial results stream in.
    const runBatchComplete = !running && pendingModelIds.length === 0;
    for (const list of byRun.values()) {
      if (list.length === 0) continue;
      let min = Infinity;
      let max = -Infinity;
      for (const row of list) {
        min = Math.min(min, row.cost);
        max = Math.max(max, row.cost);
      }
      const span = max - min;
      for (const row of list) {
        const scale = span <= 0 ? 0 : (row.cost - min) / span;
        scales.set(row.modelId, scale);
        if (
          runBatchComplete &&
          row.cost === min &&
          list.length >= 2
        ) {
          winners.add(row.modelId);
        }
      }
    }
    return { scales, winners };
  }, [modelHistories, versionIndexByModel, running, pendingModelIds.length]);

  const cheapestModelIds = costScaleByModelId.winners;

  const avgCostByModel = useMemo(() => {
    const map = new Map<string, ModelCostAverage>();
    for (const row of modelCostAverages) map.set(row.modelId, row);
    return map;
  }, [modelCostAverages]);

  const ratingStatsByModel = useMemo(() => {
    const map = new Map<string, ModelRatingStats>();
    for (const row of modelRatingStats) map.set(row.modelId, row);
    return map;
  }, [modelRatingStats]);

  const selectedRunCostEstimate = useMemo(() => {
    let totalUsd = 0;
    let pricedCount = 0;
    let unknownCount = 0;
    let usedAvg = false;
    for (const model of selectableModels) {
      if (!selectedModels.has(model.id)) continue;
      const avg = avgCostByModel.get(model.id);
      if (avg && avg.sampleCount > 0 && Number.isFinite(avg.avgUsd)) {
        totalUsd += avg.avgUsd;
        pricedCount += 1;
        usedAvg = true;
        continue;
      }
      const catalog = parseApproxCostUsd(model.approxCost);
      if (catalog != null) {
        totalUsd += catalog;
        pricedCount += 1;
        continue;
      }
      unknownCount += 1;
    }
    return { totalUsd, pricedCount, unknownCount, usedAvg };
  }, [selectableModels, selectedModels, avgCostByModel]);

  const savedCountByModel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of modelHistories) {
      counts.set(entry.modelId, entry.versions.length);
    }
    return counts;
  }, [modelHistories]);

  function openPreview(
    src: string | null | undefined,
    label: string,
    originalUrl?: string | null,
    gallery?: PreviewImage[],
  ) {
    if (!src) return;
    const item: PreviewImage = {
      src,
      label,
      originalUrl: originalUrl ?? null,
    };
    const items =
      gallery && gallery.length > 0 ? [...gallery] : [item];
    let index = items.findIndex((entry) => entry.src === src);
    if (index < 0) {
      items.unshift(item);
      index = 0;
    }
    setPreview({ items, index });
  }

  const stepPreview = useCallback((delta: number) => {
    setPreview((prev) => {
      if (!prev || prev.items.length < 2) return prev;
      const next =
        (prev.index + delta + prev.items.length) % prev.items.length;
      return { ...prev, index: next };
    });
  }, []);

  const previewGalleryItems = useMemo(() => {
    const originalUrl = selectedPhoto?.signedUrl ?? null;
    const items: PreviewImage[] = [];
    for (const entry of modelHistories) {
      const index = Math.min(
        versionIndexByModel[entry.modelId] ?? 0,
        entry.versions.length - 1,
      );
      const result = entry.versions[index];
      if (!result?.ok || !result.imageUrl) continue;
      items.push({
        src: result.imageUrl,
        label: entry.label,
        originalUrl,
        result,
        costScale: costScaleByModelId.scales.get(entry.modelId) ?? null,
        isCheapest: costScaleByModelId.winners.has(entry.modelId),
      });
    }
    return items;
  }, [
    modelHistories,
    versionIndexByModel,
    selectedPhoto?.signedUrl,
    costScaleByModelId,
  ]);

  const photoPickerGallery = useMemo(
    () =>
      photos
        .filter((photo) => Boolean(photo.signedUrl))
        .map(
          (photo): PreviewImage => ({
            src: photo.signedUrl as string,
            label: photo.listing_title || photoRoleLabel(photo.role),
            originalUrl: null,
            photoMeta: {
              role: photoRoleLabel(photo.role),
              listingTitle: photo.listing_title,
              platform: PLATFORM_LABELS[photo.listing_platform],
              ownerEmail: photo.owner_email,
            },
          }),
        ),
    [photos],
  );

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
      startTransition(() => {
        applyHistory(runs, true);
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
        const runs = ((json.recentRuns as RecentRunSummary[]) ?? []).filter(
          (run) =>
            !run.photoRole ||
            !isIdentifyPhotoRole(run.photoRole as PhotoRole),
        );
        setRecentRuns(runs);
        if (Array.isArray(json.modelCostAverages)) {
          setModelCostAverages(json.modelCostAverages as ModelCostAverage[]);
        }
        if (Array.isArray(json.modelRatingStats)) {
          setModelRatingStats(json.modelRatingStats as ModelRatingStats[]);
        }
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
        startTransition(() => {
          applyHistory(runs, true);
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

  async function loadSavedResultCounts(photoIds: string[]) {
    const ids = [...new Set(photoIds.filter(Boolean))];
    if (ids.length === 0) return;
    try {
      const params = new URLSearchParams({
        photoIds: ids.join(","),
      });
      const res = await fetch(`/api/admin/bg-debug/run?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const counts = (json.counts ?? {}) as Record<string, number>;
      setSavedResultCounts((prev) => ({ ...prev, ...counts }));
    } catch {
      /* non-fatal */
    }
  }

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
      const list = (json.photos as AdminPhoto[]).filter(
        (photo) => !isIdentifyPhotoRole(photo.role),
      );
      startTransition(() => {
        setPhotos(list);
        setTotal(json.total as number);
        setSelectedPhotoId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      });
      void loadSavedResultCounts(list.map((p) => p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load photos");
    } finally {
      setLoading(false);
    }
  }

  function toggleModel(id: FalBgModelId) {
    setSessionModels(() => {
      const next = new Set(selectedModels);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setModelScoped(id: FalBgModelId, scoped: boolean) {
    const nextDescoped = new Set(descopedIds);
    if (scoped) nextDescoped.delete(id);
    else nextDescoped.add(id);

    const nextDefault =
      !scoped && defaultListingModelId === id
        ? ""
        : defaultListingModelId;

    writeBgModelCatalogPrefs({
      descopedModelIds: [...nextDescoped],
      defaultListingModelId: nextDefault,
    });

    setSessionModels((prev) => {
      const base = new Set(prev ?? selectedModels);
      if (!scoped) base.delete(id);
      return base;
    });
  }

  function setDefaultListingModel(next: FalBgModelId | "") {
    writeBgModelCatalogPrefs({
      defaultListingModelId: next,
    });
  }

  function chooseLabBackdrop(next: LabBackdrop) {
    writeStoredLabPrefs({ labBackdrop: next });
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
    setSelectedRunId(run.id);
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
          const list = ((json.photos as AdminPhoto[]) ?? []).filter(
            (photo) => !isIdentifyPhotoRole(photo.role),
          );
          startTransition(() => {
            setRole("all");
            setPhotos((prev) => {
              const byId = new Map(prev.map((p) => [p.id, p]));
              for (const photo of list) byId.set(photo.id, photo);
              return [...byId.values()];
            });
            setTotal(json.total ?? list.length);
          });
          void loadSavedResultCounts(list.map((p) => p.id));
        }
      } catch {
        /* history load for photoId still proceeds */
      }
    }
    await loadHistory(run.photoId);
  }

  function selectPhoto(photoId: string) {
    setSelectedRunId(null);
    setSelectedPhotoId(photoId);
  }

  function patchResultRating(
    resultId: string,
    modelId: string,
    rating: "up" | "down" | null,
    previous: "up" | "down" | null | undefined,
  ) {
    setHistory((prev) =>
      prev.map((run) => ({
        ...run,
        results: run.results.map((result) =>
          result.id === resultId ? { ...result, rating } : result,
        ),
      })),
    );

    setPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.result?.id === resultId && item.result
            ? { ...item, result: { ...item.result, rating } }
            : item,
        ),
      };
    });

    setModelRatingStats((prev) => {
      const next = [...prev];
      const idx = next.findIndex((row) => row.modelId === modelId);
      const row =
        idx >= 0
          ? { ...next[idx] }
          : { modelId, upCount: 0, downCount: 0 };
      if (previous === "up") row.upCount = Math.max(0, row.upCount - 1);
      if (previous === "down") row.downCount = Math.max(0, row.downCount - 1);
      if (rating === "up") row.upCount += 1;
      if (rating === "down") row.downCount += 1;
      if (idx >= 0) next[idx] = row;
      else if (row.upCount > 0 || row.downCount > 0) next.push(row);
      return next.filter((r) => r.upCount > 0 || r.downCount > 0);
    });
  }

  async function rateResult(
    result: RunResult,
    next: "up" | "down",
  ) {
    if (!result.id) return;
    const previous = result.rating ?? null;
    const rating = previous === next ? null : next;
    setRatingBusyId(result.id);
    setError(null);
    // Optimistic update
    patchResultRating(result.id, result.modelId, rating, previous);
    try {
      const res = await fetch("/api/admin/bg-debug/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id, rating }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not save rating",
        );
      }
      const saved =
        json.rating === "up" || json.rating === "down" ? json.rating : null;
      if (saved !== rating) {
        patchResultRating(result.id, result.modelId, saved, rating);
      }
    } catch (err) {
      patchResultRating(result.id, result.modelId, previous, rating);
      setError(err instanceof Error ? err.message : "Could not save rating");
    } finally {
      setRatingBusyId(null);
    }
  }

  async function runModels() {
    if (!selectedPhoto || selectedModels.size === 0) return;
    const modelIds = [...selectedModels] as FalBgModelId[];
    const total = modelIds.length;
    const photoIdForRun = selectedPhoto.id;
    writeStoredLabPrefs({
      selectedModels: modelIds,
      labBackdrop,
    });
    setSessionModels(new Set(modelIds));
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
      if (result.ok && result.imageUrl) {
        setSavedResultCounts((prev) => ({
          ...prev,
          [photoIdForRun]: (prev[photoIdForRun] ?? 0) + 1,
        }));
      }
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
              if (event.runId) setSelectedRunId(event.runId);
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
      void loadSavedResultCounts([photoIdForRun]);
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
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-8 sm:px-6">
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
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          >
            Settings
          </button>
          <Link
            href="/app"
            className="text-base font-semibold text-[var(--accent)] hover:underline"
          >
            ← Back to listings
          </Link>
        </div>
      </header>

      {settingsOpen ? (
        <BgModelSettingsDialog
          models={models}
          descopedIds={descopedIds}
          defaultListingModelId={defaultListingModelId}
          onSetScoped={setModelScoped}
          onSetDefault={setDefaultListingModel}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)_13.5rem]">
        <div className="flex max-h-[calc(100vh-1rem)] flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="shrink-0">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Photo selection
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {loading ? "Loading…" : `${photos.length} shown · ${total} total`}
            </p>
          </div>
          <form
            className="grid shrink-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
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

          <ul className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto overscroll-contain sm:grid-cols-3">
            {photos.map((photo) => {
              const active = photo.id === selectedPhoto?.id;
              const previewLabel =
                photo.listing_title || photoRoleLabel(photo.role);
              const savedCount = savedResultCounts[photo.id] ?? 0;
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
                          selectPhoto(photo.id);
                        }}
                        className="block w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.signedUrl ?? undefined}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="aspect-square w-full bg-[var(--surface-muted)] object-cover"
                        />
                      </button>
                      {savedCount > 0 ? (
                        <span
                          className="pointer-events-none absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1.5 text-[11px] font-bold tabular-nums text-white"
                          title={`${savedCount} saved AI result${savedCount === 1 ? "" : "s"}`}
                        >
                          {savedCount}
                        </span>
                      ) : null}
                      <MagnifyButton
                        disabled={!photo.signedUrl}
                        onClick={() =>
                          openPreview(
                            photo.signedUrl,
                            previewLabel,
                            null,
                            photoPickerGallery,
                          )
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

        <div className="flex min-w-0 flex-col gap-5">
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
                        null,
                        photoPickerGallery,
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
                      : selectedRecentRun
                        ? modelHistories.length > 0
                          ? `Showing ${modelHistories.length} model${modelHistories.length === 1 ? "" : "s"} from the selected run`
                          : "Selected run has no saved model results."
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
              {selectableModels.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-sm text-[var(--muted)]">
                  All models are descoped. Open Settings to include some again.
                </li>
              ) : null}
              {selectableModels.map((model) => {
                const savedCount = savedCountByModel.get(model.id) ?? 0;
                const avg = avgCostByModel.get(model.id);
                const ratings = ratingStatsByModel.get(model.id);
                const catalogCents = formatApproxCostCents(model.approxCost);
                const avgCents =
                  avg && avg.sampleCount > 0
                    ? formatCostUsd(avg.avgUsd)
                    : null;
                const costParts = [
                  catalogCents === "unpriced"
                    ? "unpriced"
                    : `est ${catalogCents}`,
                ];
                if (avgCents) {
                  costParts.push(`avg ${avgCents} · n=${avg!.sampleCount}`);
                }
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
                            ({costParts.join(" · ")})
                          </span>
                          {savedCount > 0 ? (
                            <span className="ml-2 font-normal text-[var(--accent)]">
                              · {savedCount} saved
                            </span>
                          ) : null}
                          {ratings &&
                          (ratings.upCount > 0 || ratings.downCount > 0) ? (
                            <span className="ml-2 inline-flex items-center gap-1.5 font-normal tabular-nums text-[var(--muted)]">
                              <span className="inline-flex items-center gap-0.5 text-emerald-700">
                                <ThumbUpIcon className="h-3 w-3" />
                                {ratings.upCount}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-rose-700">
                                <ThumbDownIcon className="h-3 w-3" />
                                {ratings.downCount}
                              </span>
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
                    onClick={() => chooseLabBackdrop(option.id)}
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

            <div className="mt-4 flex max-w-md flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
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
              {selectedModels.size > 0 &&
              selectedRunCostEstimate.pricedCount > 0 ? (
                <p
                  className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]"
                  title={
                    selectedRunCostEstimate.usedAvg
                      ? "Sum of running averages where available, otherwise catalog estimates"
                      : "Sum of catalog unit-price estimates for the selected models"
                  }
                >
                  ~{formatCostUsd(selectedRunCostEstimate.totalUsd)}
                  {selectedRunCostEstimate.unknownCount > 0 ? (
                    <span className="ml-1 font-normal text-[var(--muted)]">
                      +{selectedRunCostEstimate.unknownCount} unpriced
                    </span>
                  ) : null}
                </p>
              ) : selectedModels.size > 0 ? (
                <p className="shrink-0 text-sm text-[var(--muted)]">
                  Cost unknown
                </p>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Run calls fal and appends a new saved version. Switching photos or
              flipping versions below only loads stored results. Model picks and
              backdrop are remembered for your next visit.
            </p>
          </div>

      {selectedPhoto ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {selectedRecentRun
                  ? "Results from selected run"
                  : "Saved results by model"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {selectedRecentRun
                  ? "Only this lab run's outputs. Pick the photo (or clear the run) to browse all saved versions."
                  : "Flip older/newer versions per model without re-running. Cost badges show fal's actual billed amount when available."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedRecentRun ? (
                <button
                  type="button"
                  onClick={() => setSelectedRunId(null)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                >
                  Show all for photo
                </button>
              ) : null}
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
                    onClick={() => chooseLabBackdrop(option.id)}
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
            <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingModelIds.map((modelId) => {
                const model = models.find((m) => m.id === modelId);
                const label = model?.label ?? modelId;
                return (
                  <article
                    key={`pending-${modelId}`}
                    className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]"
                  >
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
                    <div className="border-t border-[var(--border)] px-3 py-2">
                      <p
                        className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-[var(--foreground)]"
                        title={label}
                      >
                        {label}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Running…
                      </p>
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
                const isCheapest = cheapestModelIds.has(entry.modelId);

                return (
                  <article
                    key={entry.modelId}
                    className={`overflow-hidden rounded-xl ring-1 transition ${
                      isFresh
                        ? "ring-[var(--accent)]"
                        : "ring-[var(--border)]"
                    }`}
                  >
                    {result.ok && result.imageUrl ? (
                      <ResultCompareImage
                        resultUrl={result.imageUrl}
                        originalUrl={selectedPhoto?.signedUrl ?? null}
                        label={entry.label}
                        backdrop={labBackdrop}
                        onOpenFull={() =>
                          openPreview(
                            result.imageUrl,
                            entry.label,
                            selectedPhoto?.signedUrl ?? null,
                            previewGalleryItems,
                          )
                        }
                      />
                    ) : (
                      <p
                        className="flex aspect-square w-full items-center justify-center bg-red-50 px-3 text-center text-sm text-red-800"
                      >
                        {result.error || "No image"}
                      </p>
                    )}
                    <div className="border-t border-[var(--border)] px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="line-clamp-2 min-h-[2.5rem] min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--foreground)]"
                          title={entry.label}
                        >
                          {entry.label}
                          {isFresh ? (
                            <span className="ml-1.5 inline text-xs font-semibold text-[var(--accent)]">
                              just in
                            </span>
                          ) : null}
                        </p>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <CostBadge
                            result={result}
                            costScale={
                              costScaleByModelId.scales.get(entry.modelId) ??
                              null
                            }
                          />
                          {isCheapest ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm ring-1 ring-amber-500/60">
                              <CheapestStarIcon className="h-3 w-3" />
                              Cheapest!
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {result.provider} · {formatDurationSeconds(result.ms)}
                        {result.ok ? "" : " · failed"}
                      </p>
                      {result.createdAt || result.falDashboardUrl ? (
                        <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-[var(--muted)]">
                          <span className="min-w-0 truncate">
                            {result.createdAt ? (
                              <LocalDateTime iso={result.createdAt} />
                            ) : null}
                          </span>
                          <FalRequestMeta result={result} />
                        </div>
                      ) : null}
                      {entry.versions.length > 1 ? (
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={!canNewer || running}
                            onClick={() =>
                              stepVersion(
                                entry.modelId,
                                -1,
                                entry.versions.length,
                              )
                            }
                            className="rounded px-1 py-0.5 text-[10px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:opacity-30"
                          >
                            Newer
                          </button>
                          <span className="text-[10px] tabular-nums text-[var(--muted)]">
                            {index + 1}/{entry.versions.length}
                          </span>
                          <button
                            type="button"
                            disabled={!canOlder || running}
                            onClick={() =>
                              stepVersion(
                                entry.modelId,
                                1,
                                entry.versions.length,
                              )
                            }
                            className="rounded px-1 py-0.5 text-[10px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:opacity-30"
                          >
                            Older
                          </button>
                        </div>
                      ) : null}
                      {result.ok && result.id ? (
                        <div className="mt-1.5 flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Thumbs up — good result"
                            aria-label="Thumbs up"
                            aria-pressed={result.rating === "up"}
                            disabled={ratingBusyId === result.id || running}
                            onClick={() => void rateResult(result, "up")}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40 ${
                              result.rating === "up"
                                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400"
                                : "text-[var(--muted)] hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                          >
                            <ThumbUpIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Thumbs down — poor result"
                            aria-label="Thumbs down"
                            aria-pressed={result.rating === "down"}
                            disabled={ratingBusyId === result.id || running}
                            onClick={() => void rateResult(result, "down")}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40 ${
                              result.rating === "down"
                                ? "bg-rose-100 text-rose-700 ring-1 ring-rose-400"
                                : "text-[var(--muted)] hover:bg-rose-50 hover:text-rose-700"
                            }`}
                          >
                            <ThumbDownIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
        </div>

        <aside className="flex max-h-[calc(100vh-1rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Recent runs
            </h2>
            <button
              type="button"
              onClick={() => void loadRecentRuns()}
              className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              title="Refresh recent runs"
            >
              Refresh
            </button>
          </div>
          {recentRuns.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[var(--muted)]">
              No runs yet — pick a photo and run models.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              {recentRuns.map((run) => {
                const active = selectedRunId === run.id;
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
                      title={`${run.listingTitle || platform || "Listing"} · ${roleLabel}`}
                      className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition ${
                        active
                          ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                          : "hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <div
                        className="h-10 w-10 shrink-0 overflow-hidden rounded-md ring-1 ring-[var(--border)]"
                        style={resultBackdropStyle(labBackdrop)}
                      >
                        {run.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={run.thumbUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[9px] text-[var(--muted)]">
                            —
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold leading-tight text-[var(--foreground)]">
                          {run.listingTitle || platform || "Listing"}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] leading-tight text-[var(--muted)]">
                          {roleLabel} · {run.okCount}/{run.resultCount}
                          {run.createdAt ? (
                            <>
                              {" · "}
                              <LocalDateTime
                                iso={run.createdAt}
                                className="inline"
                              />
                            </>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {preview ? (
        <ImageLightbox
          item={preview.items[preview.index]!}
          backdrop={labBackdrop}
          index={preview.index}
          total={preview.items.length}
          ratingBusy={
            preview.items[preview.index]?.result?.id != null &&
            ratingBusyId === preview.items[preview.index]?.result?.id
          }
          onRate={
            preview.items[preview.index]?.result
              ? (next) => {
                  const result = preview.items[preview.index]?.result;
                  if (result) void rateResult(result, next);
                }
              : undefined
          }
          onPrev={
            preview.items.length > 1 ? () => stepPreview(-1) : undefined
          }
          onNext={
            preview.items.length > 1 ? () => stepPreview(1) : undefined
          }
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

function FalRequestMeta({ result }: { result: RunResult }) {
  const href = result.falDashboardUrl;
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex shrink-0 items-center gap-0.5 font-normal text-[var(--accent)] hover:underline"
      title="Opens this request in fal Recent History (includes billed cost when available)"
    >
      fal
      <ExternalLinkIcon className="h-3 w-3 opacity-80" />
    </a>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 5h5v5" />
      <path d="M10 14L19 5" />
      <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 10.5A1.5 1.5 0 0 1 3.5 9H7v10H3.5A1.5 1.5 0 0 1 2 17.5v-7Z" />
      <path d="M7 19V9.2l3.05-5.49A1.8 1.8 0 0 1 11.62 3c.99 0 1.8.8 1.8 1.78V8h4.72c1.4 0 2.46 1.28 2.2 2.66l-1.2 6.4A2.25 2.25 0 0 1 16.94 19H7Z" />
    </svg>
  );
}

function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22 13.5A1.5 1.5 0 0 1 20.5 15H17V5h3.5A1.5 1.5 0 0 1 22 6.5v7Z" />
      <path d="M17 5v9.8l-3.05 5.49A1.8 1.8 0 0 1 12.38 21c-.99 0-1.8-.8-1.8-1.78V16H5.86c-1.4 0-2.46-1.28-2.2-2.66l1.2-6.4A2.25 2.25 0 0 1 7.06 5H17Z" />
    </svg>
  );
}

function CheapestStarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.5 14.6 9h6.9l-5.6 4.1 2.1 6.4L12 15.8 5.99 19.5 8.1 13.1 2.5 9h6.9L12 2.5Z" />
    </svg>
  );
}

function CompareHoldButton({
  active,
  onHoldStart,
  onHoldEnd,
  onHoldCancel,
  className,
}: {
  active: boolean;
  onHoldStart: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onHoldEnd: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onHoldCancel: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title="Hold to compare with original"
      aria-label="Hold to compare with original"
      aria-pressed={active}
      onPointerDown={onHoldStart}
      onPointerUp={onHoldEnd}
      onPointerCancel={onHoldEnd}
      onLostPointerCapture={onHoldCancel}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
    >
      <CompareIcon className="h-4 w-4" />
    </button>
  );
}

function CompareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
      <path d="M10 12h4" />
    </svg>
  );
}

function ResultCompareImage({
  resultUrl,
  originalUrl,
  label,
  backdrop,
  onOpenFull,
}: {
  resultUrl: string;
  originalUrl: string | null;
  label: string;
  backdrop: LabBackdrop;
  onOpenFull: () => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const showingOriginal = Boolean(showOriginal && originalUrl);
  const src = showingOriginal && originalUrl ? originalUrl : resultUrl;

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
    <div className="relative">
      <button
        type="button"
        onClick={onOpenFull}
        title="View full size"
        className="block w-full cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="aspect-square w-full object-contain"
          style={
            showingOriginal
              ? { backgroundColor: "#f3f4f6" }
              : resultBackdropStyle(backdrop)
          }
        />
      </button>
      {showingOriginal ? (
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          Original
        </span>
      ) : null}
      {originalUrl ? (
        <CompareHoldButton
          active={showingOriginal}
          onHoldStart={holdStart}
          onHoldEnd={holdEnd}
          onHoldCancel={() => setShowOriginal(false)}
          className={`absolute bottom-2 left-2 z-10 flex h-8 w-8 select-none items-center justify-center rounded-full text-white shadow-sm backdrop-blur-[1px] transition touch-none ${
            showingOriginal
              ? "bg-[var(--accent)]"
              : "bg-black/45 hover:bg-black/60"
          }`}
        />
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
  item,
  backdrop = "white",
  index = 0,
  total = 1,
  ratingBusy = false,
  onRate,
  onPrev,
  onNext,
  onClose,
}: {
  item: PreviewImage;
  backdrop?: LabBackdrop;
  index?: number;
  total?: number;
  ratingBusy?: boolean;
  onRate?: (next: "up" | "down") => void;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const originalUrl = item.originalUrl ?? null;
  const showingOriginal = Boolean(showOriginal && originalUrl);
  const displaySrc =
    showingOriginal && originalUrl ? originalUrl : item.src;
  const canNav = Boolean(onPrev && onNext && total > 1);
  const result = item.result ?? null;
  const photoMeta = item.photoMeta ?? null;

  useEffect(() => {
    setShowOriginal(false);
  }, [item.src]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose, onPrev, onNext]);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 touch-target rounded-xl bg-white/95 px-4 text-base font-semibold text-[var(--foreground)]"
      >
        Close
      </button>
      {canNav ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev?.();
            }}
            className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-xl font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-white sm:left-4"
            aria-label="Previous photo"
            title="Previous (←)"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext?.();
            }}
            className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-xl font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-white sm:right-4"
            aria-label="Next photo"
            title="Next (→)"
          >
            ›
          </button>
        </>
      ) : null}
      <div
        className="relative flex max-h-full w-full max-w-[min(96vw,1200px)] flex-col items-stretch gap-3 lg:flex-row lg:items-start lg:gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative min-w-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt={item.label}
            draggable={false}
            className="max-h-[min(78vh,1000px)] w-full rounded-lg object-contain shadow-2xl"
            style={
              showingOriginal
                ? { backgroundColor: "#f3f4f6" }
                : resultBackdropStyle(backdrop)
            }
          />
          {showingOriginal ? (
            <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/55 px-2 py-1 text-xs font-semibold text-white">
              Original
            </span>
          ) : null}
          {originalUrl ? (
            <CompareHoldButton
              active={showingOriginal}
              onHoldStart={holdStart}
              onHoldEnd={holdEnd}
              onHoldCancel={() => setShowOriginal(false)}
              className={`absolute bottom-3 left-3 z-10 flex h-10 w-10 select-none items-center justify-center rounded-full text-white shadow-sm backdrop-blur-[1px] transition touch-none ${
                showingOriginal
                  ? "bg-[var(--accent)]"
                  : "bg-black/45 hover:bg-black/60"
              }`}
            />
          ) : null}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 rounded-xl bg-white p-4 shadow-xl lg:w-72">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {result ? "Model result" : "Photo"}
            </p>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-[var(--foreground)]">
              {showingOriginal ? `${item.label} · original` : item.label}
            </h2>
            {canNav ? (
              <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--muted)]">
                {index + 1} / {total}
              </p>
            ) : null}
          </div>

          {result ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CostBadge result={result} costScale={item.costScale ?? null} />
                {item.isCheapest ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950 shadow-sm ring-1 ring-amber-500/60">
                    <CheapestStarIcon className="h-3 w-3" />
                    Cheapest!
                  </span>
                ) : null}
              </div>
              <dl className="space-y-1.5 text-sm text-[var(--muted)]">
                <div className="flex justify-between gap-3">
                  <dt>Provider</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {result.provider}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Time</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {formatDurationSeconds(result.ms)}
                    {result.ok ? "" : " · failed"}
                  </dd>
                </div>
                {result.createdAt ? (
                  <div className="flex justify-between gap-3">
                    <dt>Saved</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      <LocalDateTime iso={result.createdAt} />
                    </dd>
                  </div>
                ) : null}
                {result.falDashboardUrl ? (
                  <div className="flex justify-between gap-3">
                    <dt>Request</dt>
                    <dd>
                      <FalRequestMeta result={result} />
                    </dd>
                  </div>
                ) : null}
              </dl>
              {result.ok && result.id && onRate ? (
                <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
                  <p className="mr-auto text-sm font-semibold text-[var(--foreground)]">
                    Rate result
                  </p>
                  <button
                    type="button"
                    title="Thumbs up — good result"
                    aria-label="Thumbs up"
                    aria-pressed={result.rating === "up"}
                    disabled={ratingBusy}
                    onClick={() => onRate("up")}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition disabled:opacity-40 ${
                      result.rating === "up"
                        ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400"
                        : "text-[var(--muted)] hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    <ThumbUpIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    title="Thumbs down — poor result"
                    aria-label="Thumbs down"
                    aria-pressed={result.rating === "down"}
                    disabled={ratingBusy}
                    onClick={() => onRate("down")}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition disabled:opacity-40 ${
                      result.rating === "down"
                        ? "bg-rose-100 text-rose-700 ring-1 ring-rose-400"
                        : "text-[var(--muted)] hover:bg-rose-50 hover:text-rose-700"
                    }`}
                  >
                    <ThumbDownIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
            </>
          ) : photoMeta ? (
            <dl className="space-y-1.5 text-sm text-[var(--muted)]">
              <div className="flex justify-between gap-3">
                <dt>Role</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {photoMeta.role}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Listing</dt>
                <dd className="max-w-[10rem] truncate text-right font-semibold text-[var(--foreground)]">
                  {photoMeta.listingTitle || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Platform</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {photoMeta.platform}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Owner</dt>
                <dd className="max-w-[10rem] truncate text-right font-semibold text-[var(--foreground)]">
                  {photoMeta.ownerEmail || "—"}
                </dd>
              </div>
            </dl>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function BgModelSettingsDialog({
  models,
  descopedIds,
  defaultListingModelId,
  onSetScoped,
  onSetDefault,
  onClose,
}: {
  models: FalBgModelDef[];
  descopedIds: Set<FalBgModelId>;
  defaultListingModelId: FalBgModelId | "";
  onSetScoped: (id: FalBgModelId, scoped: boolean) => void;
  onSetDefault: (id: FalBgModelId | "") => void;
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

  const scoped = models.filter((m) => !descopedIds.has(m.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Background model settings"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Model settings
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Choose the listing-page default and which models appear in
              selectors. Descoped models stay out of the lab run list and the
              listing clean-bg dropdown.
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

        <label className="mt-5 flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-[var(--foreground)]">
            Default listing clean-bg model
          </span>
          <select
            value={defaultListingModelId}
            onChange={(e) => {
              const next = e.target.value;
              onSetDefault(
                next && scoped.some((m) => m.id === next)
                  ? (next as FalBgModelId)
                  : "",
              );
            }}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)]"
          >
            <option value="">Production default (hanger-safe)</option>
            {scoped.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} · {formatApproxCostCents(model.approxCost)}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Models in selectors
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Uncheck to descope — hidden from the lab model list and listing
            dropdown.
          </p>
          <ul className="mt-3 space-y-2">
            {models.map((model) => {
              const scopedOn = !descopedIds.has(model.id);
              return (
                <li key={model.id}>
                  <label
                    className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2 ${
                      scopedOn
                        ? "border-[var(--border)] bg-white"
                        : "border-dashed border-[var(--border)] bg-[var(--surface-muted)] opacity-80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={scopedOn}
                      onChange={(e) =>
                        onSetScoped(model.id, e.target.checked)
                      }
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">
                        {model.label}
                        {!scopedOn ? (
                          <span className="ml-2 font-normal text-[var(--muted)]">
                            · descoped
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {formatApproxCostCents(model.approxCost)} ·{" "}
                        {model.description}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
