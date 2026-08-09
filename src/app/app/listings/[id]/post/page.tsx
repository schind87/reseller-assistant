"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { CopyField } from "@/components/CopyField";
import { ExtensionInstallCard } from "@/components/ExtensionInstallCard";
import { QrPanel } from "@/components/QrPanel";
import {
  getSeedListingSchema,
  structuredKey,
  type PlatformListingSchema,
} from "@/lib/listing-schemas";
import {
  requestExtensionPair,
  waitForExtensionPairAck,
} from "@/lib/extension-bridge";
import {
  PLATFORM_LABELS,
  POSTING_CHECKLIST,
  SELL_PAGE_URLS,
} from "@/lib/platforms";
import type { Listing, Platform, StructuredFields } from "@/lib/types";

function valueForField(
  listing: Listing,
  fieldId: string,
  source: PlatformListingSchema["fields"][number]["source"]
): string {
  if (source === "title") return listing.title ?? "";
  if (source === "description") return listing.description ?? "";
  if (source === "price") {
    return listing.price != null ? String(listing.price) : "";
  }
  const key = structuredKey(source);
  if (!key) return "";
  const structured = (listing.structured_fields ?? {}) as StructuredFields &
    Record<string, unknown>;
  const value = structured[key];
  if (Array.isArray(value)) return value.join(", ");
  if (value == null) return "";
  return String(value);
}

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [schema, setSchema] = useState<PlatformListingSchema | null>(null);
  const [extensionUrl, setExtensionUrl] = useState<string | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/listings/${params.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load listing");
        const l = json.listing as Listing;
        setListing(l);

        const platform = l.platform as Platform;
        const schemaRes = await fetch(`/api/platforms/${platform}/schema`);
        const schemaJson = await schemaRes.json();
        setSchema(
          schemaRes.ok && schemaJson.schema
            ? (schemaJson.schema as PlatformListingSchema)
            : getSeedListingSchema(platform)
        );

        const tokenRes = await fetch(
          `/api/listings/${params.id}/join-token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ purpose: "extension" }),
          }
        );
        const tokenJson = await tokenRes.json();
        if (tokenRes.ok) {
          setExtensionUrl(tokenJson.url);
          if (tokenJson.token) {
            setExtensionStatus("Connecting Chrome extension…");
            requestExtensionPair({
              token: String(tokenJson.token),
              listingId: String(params.id),
              joinCode: l.join_code,
              openSidePanel: true,
            });
            const ack = await waitForExtensionPairAck(2000);
            setExtensionStatus(
              ack.ok
                ? "Chrome extension connected for this listing."
                : "Extension not detected yet — load unpacked from extension-live, or use the pairing code below."
            );
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load listing");
      }
    }
    if (params.id) void load();
  }, [params.id]);

  async function markPosted() {
    if (!listing) return;
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "posted",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not mark posted");
      setListing(json.listing);
      setDoneMessage("Marked as posted. Nice work.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark posted");
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
        Loading posting checklist…
      </main>
    );
  }

  const platform = listing.platform as Platform;
  const checklist = POSTING_CHECKLIST[platform];
  const copyFields = schema.fields.filter((field) => field.copyable);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <header>
        <Link
          href={`/app/listings/${listing.id}`}
          className="text-base font-semibold text-[var(--accent)]"
        >
          ← Back to hub
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-brand)] text-4xl">
          Post on {PLATFORM_LABELS[platform]}
        </h1>
        <p className="mt-2 text-lg text-[var(--muted)]">
          Copy each {PLATFORM_LABELS[platform]} field in order — same labels as
          the sell form.
        </p>
      </header>

      {doneMessage ? (
        <p className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-base text-[var(--accent)]">
          {doneMessage}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      <a
        href={schema.sellPageUrl || SELL_PAGE_URLS[platform]}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <BigButton>Open {PLATFORM_LABELS[platform]} sell page</BigButton>
      </a>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Easy posting with the Chrome helper
        </h2>
        <ol className="list-decimal space-y-3 pl-5 text-base text-[var(--muted)]">
          <li>
            Keep this page open so the Chrome extension stays connected
            {extensionStatus ? (
              <>
                {" "}
                —{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {extensionStatus}
                </span>
              </>
            ) : null}
            .
          </li>
          <li>
            Tap{" "}
            <span className="font-semibold text-[var(--foreground)]">
              Open {PLATFORM_LABELS[platform]} sell page
            </span>{" "}
            above.
          </li>
          <li>
            On that page, use the green{" "}
            <span className="font-semibold text-[var(--foreground)]">
              Reseller Assistant
            </span>{" "}
            box in the corner:{" "}
            <span className="font-semibold text-[var(--foreground)]">
              Do this for me
            </span>
            , then{" "}
            <span className="font-semibold text-[var(--foreground)]">
              Next step
            </span>
            . It walks through photos, title, description, and the rest.
          </li>
          <li>
            When the helper says to review, check the form, then press{" "}
            <span className="font-semibold text-[var(--foreground)]">
              List / Publish
            </span>{" "}
            yourself on {PLATFORM_LABELS[platform]}.
          </li>
        </ol>
        <p className="text-base text-[var(--muted)]">
          Backup if photos don’t attach: download the ZIP and choose those files
          in the marketplace picker (cover is <code>01-cover</code>).
        </p>
        <a
          href={`/api/listings/${listing.id}/photos/zip`}
          className="block"
        >
          <BigButton variant="secondary">Download listing photos ZIP</BigButton>
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Checklist
        </h2>
        {checklist.map((step) => (
          <label
            key={step.id}
            className="flex cursor-pointer gap-4 rounded-2xl border border-[var(--border)] bg-white p-4"
          >
            <input
              type="checkbox"
              className="mt-1 h-6 w-6 accent-[var(--accent)]"
              checked={Boolean(checked[step.id])}
              onChange={(e) =>
                setChecked((c) => ({ ...c, [step.id]: e.target.checked }))
              }
            />
            <span>
              <span className="block text-lg font-semibold text-[var(--foreground)]">
                {step.label}
              </span>
              <span className="mt-1 block text-base text-[var(--muted)]">
                {step.hint}
              </span>
            </span>
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Copy these ({PLATFORM_LABELS[platform]} fields)
        </h2>
        {copyFields.map((field) => {
          const value = valueForField(listing, field.id, field.source);
          return (
            <CopyField
              key={field.id}
              label={field.label}
              value={value}
              multiline={field.input === "textarea"}
            />
          );
        })}
        <CopyField label="Pairing code" value={listing.join_code} />
      </section>

      {extensionUrl ? (
        <QrPanel
          value={extensionUrl}
          title="Pair browser extension"
          hint="If the extension is installed, this page pairs automatically. Otherwise scan/open the link or enter the pairing code in the side panel."
          code={listing.join_code}
        />
      ) : null}

      <ExtensionInstallCard compact />

      <div className="flex flex-col gap-3">
        <BigButton
          disabled={listing.status === "posted"}
          onClick={() => void markPosted()}
        >
          {listing.status === "posted" ? "Already posted" : "Mark as posted"}
        </BigButton>
        <Link href={`/app/listings/${listing.id}`} className="block">
          <BigButton variant="secondary">Edit listing fields</BigButton>
        </Link>
      </div>
    </main>
  );
}
