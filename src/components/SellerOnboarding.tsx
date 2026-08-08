"use client";

import { useState, type FormEvent } from "react";
import { BigButton } from "@/components/BigButton";
import {
  composeSmokePetNotes,
  defaultListingPreferences,
  type ListingPreferences,
} from "@/lib/seller-preferences";

type SellerOnboardingProps = {
  initial?: ListingPreferences | null;
  editing?: boolean;
  onSaved: (prefs: ListingPreferences) => void;
  onCancel?: () => void;
};

function ChoiceGroup<T extends string>({
  legend,
  hint,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-semibold text-[var(--foreground)]">
        {legend}
      </legend>
      {hint ? <p className="text-base text-[var(--muted)]">{hint}</p> : null}
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`touch-target rounded-xl border px-4 py-3 text-left text-base font-semibold ${
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
    </fieldset>
  );
}

export function SellerOnboarding({
  initial,
  editing = false,
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
          These answers help the AI write accurate smoke/pet notes and match
          your usual clothing listings. You can change them later.
        </p>
      </header>

      <ChoiceGroup
        legend="Is your home smoke-free?"
        hint="Buyers on Mercari and Poshmark expect this in the description."
        value={prefs.smokeFree}
        onChange={(value) => patch("smokeFree", value)}
        options={[
          { value: "yes", label: "Yes — smoke-free home" },
          { value: "outdoor_only", label: "Smoking only outdoors" },
          { value: "no", label: "No — not smoke-free" },
        ]}
      />

      <ChoiceGroup
        legend="Do you have pets at home?"
        hint="We’ll add a clear allergy note when pets live with you."
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

      <ChoiceGroup
        legend="What do you mostly list?"
        hint="Helps titles and categories sound right for your closet."
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
        <p className="text-base text-[var(--muted)]">
          Only used if you want a seller name mentioned in drafts.
        </p>
        <input
          value={prefs.closetName ?? ""}
          onChange={(e) => patch("closetName", e.target.value || null)}
          className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
          placeholder="e.g. Sunny Closet"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-lg font-semibold">Ships from (optional)</span>
        <p className="text-base text-[var(--muted)]">
          City and state help buyers know where packages start.
        </p>
        <input
          value={prefs.shipsFrom ?? ""}
          onChange={(e) => patch("shipsFrom", e.target.value || null)}
          className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
          placeholder="e.g. Columbus, OH"
        />
      </label>

      <ChoiceGroup
        legend="Do you usually ship quickly?"
        value={prefs.shipsQuickly ? "yes" : "no"}
        onChange={(value) => patch("shipsQuickly", value === "yes")}
        options={[
          { value: "yes", label: "Yes — same or next business day when I can" },
          { value: "no", label: "Not always — don’t promise fast ship" },
        ]}
      />

      <ChoiceGroup
        legend="Are you open to offers?"
        value={prefs.acceptsOffers ? "yes" : "no"}
        onChange={(value) => patch("acceptsOffers", value === "yes")}
        options={[
          { value: "yes", label: "Yes — reasonable offers are fine" },
          { value: "no", label: "Prefer buyers take the listed price" },
        ]}
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
          {busy
            ? "Saving…"
            : editing
              ? "Save seller profile"
              : "Save and continue"}
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
