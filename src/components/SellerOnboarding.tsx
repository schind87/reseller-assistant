"use client";

import { useState, type FormEvent } from "react";
import { BigButton } from "@/components/BigButton";
import { PLATFORM_LABELS } from "@/lib/platforms";
import {
  SUPPORTED_SELLING_WEBSITES,
  composeSmokePetNotes,
  defaultListingPreferences,
  type ListingPreferences,
} from "@/lib/seller-preferences";
import type { Platform } from "@/lib/types";

type SellerOnboardingProps = {
  initial?: ListingPreferences | null;
  editing?: boolean;
  /** Compact layout for the profile screen. */
  compact?: boolean;
  onSaved: (prefs: ListingPreferences) => void;
  onCancel?: () => void;
};

function CompactChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_1fr] sm:items-center">
      <span className="text-sm font-semibold text-[var(--foreground)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-white text-[var(--foreground)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompactToggle({
  label,
  checked,
  onChange,
  yesLabel,
  noLabel,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  yesLabel: string;
  noLabel: string;
}) {
  return (
    <CompactChoice
      label={label}
      value={checked ? "yes" : "no"}
      onChange={(value) => onChange(value === "yes")}
      options={[
        { value: "yes", label: yesLabel },
        { value: "no", label: noLabel },
      ]}
    />
  );
}

export function SellerOnboarding({
  initial,
  editing = false,
  compact = false,
  onSaved,
  onCancel,
}: SellerOnboardingProps) {
  const [prefs, setPrefs] = useState<ListingPreferences>(
    () => initial ?? defaultListingPreferences()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof ListingPreferences>(
    key: K,
    value: ListingPreferences[K]
  ) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  function toggleStore(platform: Platform, enabled: boolean) {
    setPrefs((prev) => {
      const set = new Set(prev.sellingWebsites);
      if (enabled) set.add(platform);
      else set.delete(platform);
      if (set.size === 0) return prev;
      const sellingWebsites = SUPPORTED_SELLING_WEBSITES.filter((site) =>
        set.has(site)
      );
      const sellingWebsite = sellingWebsites.includes(prev.sellingWebsite)
        ? prev.sellingWebsite
        : sellingWebsites[0];
      return { ...prev, sellingWebsites, sellingWebsite };
    });
  }

  function setPrimaryStore(platform: Platform) {
    setPrefs((prev) => {
      const sellingWebsites = prev.sellingWebsites.includes(platform)
        ? prev.sellingWebsites
        : [...prev.sellingWebsites, platform];
      return { ...prev, sellingWebsites, sellingWebsite: platform };
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      onSaved(json.preferences as ListingPreferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const storeBlock = (
    <fieldset className={compact ? "space-y-2" : "space-y-3"}>
      <legend
        className={
          compact
            ? "text-sm font-semibold text-[var(--foreground)]"
            : "text-lg font-semibold text-[var(--foreground)]"
        }
      >
        Stores you sell on
      </legend>
      {!compact ? (
        <p className="text-base text-[var(--muted)]">
          Default is where new listings open.
        </p>
      ) : null}
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        {SUPPORTED_SELLING_WEBSITES.map((platform) => {
          const checked = prefs.sellingWebsites.includes(platform);
          const isPrimary = prefs.sellingWebsite === platform;
          return (
            <div
              key={platform}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                checked
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                  : "border-[var(--border)] bg-white"
              }`}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--accent)]"
                  checked={checked}
                  onChange={(e) => toggleStore(platform, e.target.checked)}
                />
                <span className="text-base font-semibold text-[var(--foreground)]">
                  {PLATFORM_LABELS[platform]}
                </span>
              </label>
              {checked ? (
                <button
                  type="button"
                  onClick={() => setPrimaryStore(platform)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                    isPrimary
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-white text-[var(--muted)]"
                  }`}
                >
                  {isPrimary ? "Default" : "Make default"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );

  if (compact) {
    return (
      <form
        onSubmit={(e) => void save(e)}
        className="flex w-full flex-col gap-4"
      >
        {storeBlock}

        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4">
          <CompactChoice
            label="Smoke-free"
            value={prefs.smokeFree}
            onChange={(value) => patch("smokeFree", value)}
            options={[
              { value: "yes", label: "Yes" },
              { value: "outdoor_only", label: "Outdoor only" },
              { value: "no", label: "No" },
            ]}
          />
          <CompactChoice
            label="Pets"
            value={prefs.pets}
            onChange={(value) => patch("pets", value)}
            options={[
              { value: "none", label: "None" },
              { value: "dogs", label: "Dogs" },
              { value: "cats", label: "Cats" },
              { value: "dogs_and_cats", label: "Both" },
              { value: "other", label: "Other" },
            ]}
          />
          {prefs.pets === "other" ? (
            <label className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_1fr] sm:items-center">
              <span className="text-sm font-semibold">Pet details</span>
              <input
                value={prefs.petDetails ?? ""}
                onChange={(e) => patch("petDetails", e.target.value || null)}
                className="touch-target w-full rounded-lg border border-[var(--border)] bg-white px-3 text-base"
                placeholder="e.g. rabbits"
              />
            </label>
          ) : null}
          <CompactChoice
            label="Mostly list"
            value={prefs.audience}
            onChange={(value) => patch("audience", value)}
            options={[
              { value: "womens", label: "Women’s" },
              { value: "mens", label: "Men’s" },
              { value: "kids", label: "Kids" },
              { value: "mixed", label: "Mix" },
            ]}
          />
          <CompactToggle
            label="Ships quickly"
            checked={prefs.shipsQuickly}
            onChange={(value) => patch("shipsQuickly", value)}
            yesLabel="Yes"
            noLabel="Not always"
          />
          <CompactToggle
            label="Open to offers"
            checked={prefs.acceptsOffers}
            onChange={(value) => patch("acceptsOffers", value)}
            yesLabel="Yes"
            noLabel="Listed price"
          />
          <label className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_1fr] sm:items-center">
            <span className="text-sm font-semibold">Closet name</span>
            <input
              value={prefs.closetName ?? ""}
              onChange={(e) => patch("closetName", e.target.value || null)}
              className="touch-target w-full rounded-lg border border-[var(--border)] bg-white px-3 text-base"
              placeholder="Optional"
            />
          </label>
          <label className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_1fr] sm:items-center">
            <span className="text-sm font-semibold">Ships from</span>
            <input
              value={prefs.shipsFrom ?? ""}
              onChange={(e) => patch("shipsFrom", e.target.value || null)}
              className="touch-target w-full rounded-lg border border-[var(--border)] bg-white px-3 text-base"
              placeholder="City, ST"
            />
          </label>
          <label className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_1fr] sm:items-start">
            <span className="pt-2 text-sm font-semibold">Extra notes</span>
            <textarea
              value={prefs.extraBuyerNotes ?? ""}
              onChange={(e) =>
                patch("extraBuyerNotes", e.target.value || null)
              }
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-base"
              placeholder="Optional buyer notes"
            />
          </label>
        </div>

        <p className="text-sm text-[var(--muted)]">
          Listing note: {composeSmokePetNotes(prefs)}
        </p>

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <BigButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save seller profile"}
          </BigButton>
          {onCancel ? (
            <BigButton type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </BigButton>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => void save(e)}
      className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10"
    >
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          {editing ? "Seller profile" : "Before your first listing"}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
          Tell us about your closet
        </h1>
        <p className="mt-3 text-lg text-[var(--muted)]">
          Used for smoke, pet, and shipping notes on your listings.
        </p>
      </header>

      {storeBlock}

      <CompactChoice
        label="Is your home smoke-free?"
        value={prefs.smokeFree}
        onChange={(value) => patch("smokeFree", value)}
        options={[
          { value: "yes", label: "Yes — smoke-free home" },
          { value: "outdoor_only", label: "Smoking only outdoors" },
          { value: "no", label: "No — not smoke-free" },
        ]}
      />

      <CompactChoice
        label="Do you have pets at home?"
        value={prefs.pets}
        onChange={(value) => patch("pets", value)}
        options={[
          { value: "none", label: "No pets" },
          { value: "dogs", label: "Dog(s)" },
          { value: "cats", label: "Cat(s)" },
          { value: "dogs_and_cats", label: "Dogs and cats" },
          { value: "other", label: "Other pets" },
        ]}
      />

      {prefs.pets === "other" ? (
        <label className="block space-y-2">
          <span className="text-lg font-semibold">What kind of pets?</span>
          <input
            value={prefs.petDetails ?? ""}
            onChange={(e) => patch("petDetails", e.target.value || null)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
            placeholder="e.g. rabbits"
          />
        </label>
      ) : null}

      <CompactChoice
        label="What do you mostly list?"
        value={prefs.audience}
        onChange={(value) => patch("audience", value)}
        options={[
          { value: "womens", label: "Women’s clothing" },
          { value: "mens", label: "Men’s clothing" },
          { value: "kids", label: "Kids’ clothing" },
          { value: "mixed", label: "A mix" },
        ]}
      />

      <label className="block space-y-2">
        <span className="text-lg font-semibold">Closet or shop name (optional)</span>
        <input
          value={prefs.closetName ?? ""}
          onChange={(e) => patch("closetName", e.target.value || null)}
          className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
          placeholder="e.g. Sunny Closet"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-lg font-semibold">Ships from (optional)</span>
        <input
          value={prefs.shipsFrom ?? ""}
          onChange={(e) => patch("shipsFrom", e.target.value || null)}
          className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
          placeholder="e.g. Columbus, OH"
        />
      </label>

      <CompactToggle
        label="Do you usually ship quickly?"
        checked={prefs.shipsQuickly}
        onChange={(value) => patch("shipsQuickly", value)}
        yesLabel="Yes — same or next business day when I can"
        noLabel="Not always — don’t promise fast ship"
      />

      <CompactToggle
        label="Are you open to offers?"
        checked={prefs.acceptsOffers}
        onChange={(value) => patch("acceptsOffers", value)}
        yesLabel="Yes — reasonable offers are fine"
        noLabel="Prefer buyers take the listed price"
      />

      <label className="block space-y-2">
        <span className="text-lg font-semibold">
          Anything else buyers should know? (optional)
        </span>
        <textarea
          value={prefs.extraBuyerNotes ?? ""}
          onChange={(e) => patch("extraBuyerNotes", e.target.value || null)}
          rows={3}
          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-lg"
          placeholder="e.g. Washed before shipping, open to bundles"
        />
      </label>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Preview note for listings
        </p>
        <p className="mt-2 text-base text-[var(--foreground)]">
          {composeSmokePetNotes(prefs)}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <BigButton type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save seller profile"}
        </BigButton>
        {editing && onCancel ? (
          <BigButton type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </BigButton>
        ) : null}
      </div>
    </form>
  );
}
