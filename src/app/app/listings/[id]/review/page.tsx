"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { ListingSchemaForm } from "@/components/ListingSchemaForm";
import { getSeedListingSchema, type PlatformListingSchema } from "@/lib/listing-schemas";
import { PLATFORM_LABELS } from "@/lib/platforms";
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
  const [schema, setSchema] = useState<PlatformListingSchema | null>(null);
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

        const platform = l.platform as Platform;
        const schemaRes = await fetch(`/api/platforms/${platform}/schema`);
        const schemaJson = await schemaRes.json();
        if (schemaRes.ok && schemaJson.schema) {
          setSchema(schemaJson.schema as PlatformListingSchema);
        } else {
          setSchema(getSeedListingSchema(platform));
        }
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

  if (!listing || !schema) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-lg text-[var(--muted)]">
        Loading review…
      </main>
    );
  }

  const platform = listing.platform as Platform;

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
          Review {PLATFORM_LABELS[platform]} draft
        </h1>
        <p className="mt-2 text-lg text-[var(--muted)]">
          Fill the same fields you will enter on {PLATFORM_LABELS[platform]} so
          posting is a one-to-one copy.
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

      <ListingSchemaForm
        schema={schema}
        title={title}
        description={description}
        price={price}
        fields={fields}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onPriceChange={setPrice}
        onFieldsChange={setFields}
        onSubmit={(e) => void save(e)}
        footer={
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
        }
      />
    </main>
  );
}
