"use client";

import { startTransition, useState } from "react";
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
  modelId: string;
  label: string;
  provider: "fal" | "photoroom";
  ok: boolean;
  ms: number;
  imageUrl: string | null;
  error?: string;
};

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
    initialPhotos[0]?.id ?? null
  );
  const [selectedModels, setSelectedModels] = useState<Set<FalBgModelId>>(
    () => new Set(models.filter((m) => m.defaultSelected).map((m) => m.id))
  );
  const [compositeWhite, setCompositeWhite] = useState(true);
  const [results, setResults] = useState<RunResult[] | null>(null);

  const selectedPhoto =
    photos.find((p) => p.id === selectedPhotoId) ?? photos[0] ?? null;

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
        setResults(null);
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
    setResults(null);
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
      setResults(json.results as RunResult[]);
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
            AI background debug
          </h1>
          <p className="mt-2 max-w-2xl text-base text-[var(--muted)]">
            Compare fal.ai (and PhotoRoom) removers on any listing photo in the
            database. Results are ephemeral — nothing is saved to the listing.
          </p>
        </div>
        <Link
          href="/app"
          className="text-base font-semibold text-[var(--accent)] hover:underline"
        >
          ← Back to listings
        </Link>
      </header>

      <div className="flex flex-wrap gap-3 text-sm">
        <span
          className={`rounded-md px-2 py-1 font-semibold ${
            hasFalKey
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-red-50 text-red-800"
          }`}
        >
          FAL_KEY {hasFalKey ? "ready" : "missing"}
        </span>
        <span
          className={`rounded-md px-2 py-1 font-semibold ${
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

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-4">
          <form
            className="flex flex-col gap-3 sm:flex-row"
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
              className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-base"
            />
            <select
              value={role}
              onChange={(e) => {
                const next = e.target.value as PhotoRole | "all";
                setRole(next);
                void loadPhotos(next, q);
              }}
              className="touch-target rounded-xl border border-[var(--border)] bg-white px-3 text-base"
            >
              {ROLE_FILTERS.map((r) => (
                <option key={r} value={r}>
                  {r === "all" ? "All roles" : photoRoleLabel(r)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="touch-target rounded-xl border border-[var(--border)] px-4 text-base font-semibold hover:bg-[var(--surface-muted)]"
            >
              Refresh
            </button>
          </form>

          <p className="text-sm text-[var(--muted)]">
            {loading ? "Loading…" : `${photos.length} shown · ${total} total`}
          </p>

          <ul className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {photos.map((photo) => {
              const active = photo.id === selectedPhoto?.id;
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhotoId(photo.id);
                      setResults(null);
                    }}
                    className={`w-full overflow-hidden rounded-xl text-left ring-1 transition ${
                      active
                        ? "ring-2 ring-[var(--accent)]"
                        : "ring-[var(--border)] hover:ring-[var(--accent)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.signedUrl ?? undefined}
                      alt=""
                      className="aspect-square w-full bg-[var(--surface-muted)] object-cover"
                    />
                    <div className="space-y-0.5 px-2 py-1.5">
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
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Selected photo
            </h2>
            {selectedPhoto ? (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhoto.signedUrl ?? undefined}
                  alt=""
                  className="max-h-64 w-full max-w-xs rounded-xl object-contain ring-1 ring-[var(--border)]"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                  }}
                />
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
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[var(--muted)]">Pick a photo to compare.</p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
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
        </div>
      </section>

      {results ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Results
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => (
              <article
                key={result.modelId}
                className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]"
              >
                <div className="border-b border-[var(--border)] px-3 py-2">
                  <p className="font-semibold text-[var(--foreground)]">
                    {result.label}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {result.provider} · {result.ms}ms
                    {result.ok ? "" : " · failed"}
                  </p>
                </div>
                {result.ok && result.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.imageUrl}
                    alt={result.label}
                    className="aspect-square w-full object-contain"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
                      backgroundSize: "16px 16px",
                      backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                    }}
                  />
                ) : (
                  <p className="bg-red-50 px-3 py-6 text-sm text-red-800">
                    {result.error || "No image"}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
