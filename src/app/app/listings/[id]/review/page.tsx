"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { FIELD_LIMITS, PLATFORM_LABELS } from "@/lib/platforms";
import {
  emptyStructuredFields,
  type Listing,
  type Platform,
  type StructuredFields,
} from "@/lib/types";

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [fields, setFields] = useState<StructuredFields>(emptyStructuredFields());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/listings/${params.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load listing");
        const l = json.listing as Listing;
        setListing(l);
        setTitle(l.title ?? "");
        setDescription(l.description ?? "");
        setPrice(l.price != null ? String(l.price) : "");
        setFields({ ...emptyStructuredFields(), ...l.structured_fields });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load listing");
      }
    }
    if (params.id) void load();
  }, [params.id]);

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!listing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          price: price === "" ? null : Number(price),
          structured_fields: fields,
          status: "ready",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setListing(json.listing);
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!listing) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/listings/${listing.id}/process`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Regenerate failed");
      const l = json.listing as Listing;
      setListing(l);
      setTitle(l.title ?? "");
      setDescription(l.description ?? "");
      setPrice(l.price != null ? String(l.price) : "");
      setFields({ ...emptyStructuredFields(), ...l.structured_fields });
      setMessage(json.draftMessage ?? "Draft regenerated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !listing) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-lg text-red-800">
        {error}
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-lg text-[var(--muted)]">
        Loading review…
      </main>
    );
  }

  const platform = listing.platform as Platform;
  const limits = FIELD_LIMITS[platform];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header>
        <Link
          href={`/app/listings/${listing.id}`}
          className="text-base font-semibold text-[var(--accent)]"
        >
          ← Back to hub
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-brand)] text-4xl">
          Review draft
        </h1>
        <p className="mt-2 text-lg text-[var(--muted)]">
          Edit anything that looks wrong for {PLATFORM_LABELS[platform]} before
          you post.
        </p>
      </header>

      {message ? (
        <p className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-base text-[var(--accent)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-5">
        <Field label={`Title (${title.length}/${limits.titleMax})`}>
          <input
            value={title}
            maxLength={limits.titleMax}
            onChange={(e) => setTitle(e.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
          />
        </Field>

        <Field
          label={`Description (${description.length}/${limits.descriptionMax})`}
        >
          <textarea
            value={description}
            maxLength={limits.descriptionMax}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-lg leading-relaxed"
          />
        </Field>

        <Field label="Price (USD)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["brand", "Brand"],
              ["category", "Category"],
              ["size", "Size"],
              ["color", "Color"],
              ["condition", "Condition"],
              ["fabric", "Fabric"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                value={fields[key] ?? ""}
                onChange={(e) =>
                  setFields((f) => ({ ...f, [key]: e.target.value || null }))
                }
                className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
              />
            </Field>
          ))}
        </div>

        <Field label="Measurements">
          <input
            value={fields.measurements ?? ""}
            onChange={(e) =>
              setFields((f) => ({
                ...f,
                measurements: e.target.value || null,
              }))
            }
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
          />
        </Field>

        <Field label="Smoke / pet notes">
          <input
            value={fields.smokePetNotes ?? ""}
            onChange={(e) =>
              setFields((f) => ({
                ...f,
                smokePetNotes: e.target.value || null,
              }))
            }
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
          />
        </Field>

        <div className="flex flex-col gap-3 pt-2">
          <BigButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </BigButton>
          <BigButton
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void regenerate()}
          >
            Regenerate with AI
          </BigButton>
          <BigButton
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              void save().then(() =>
                router.push(`/app/listings/${listing.id}/post`)
              );
            }}
          >
            Continue to post
          </BigButton>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-base font-semibold text-[var(--foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}
