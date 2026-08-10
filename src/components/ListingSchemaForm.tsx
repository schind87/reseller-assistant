"use client";

import { useMemo, type FormEvent, type ReactNode } from "react";
import type { ListingFieldDef, PlatformListingSchema } from "@/lib/listing-schemas";
import { structuredKey } from "@/lib/listing-schemas";
import {
  getMarketplaceCategoryOptions,
  getMarketplaceSubcategoryOptions,
} from "@/lib/marketplace-categories";
import type { StructuredFields } from "@/lib/types";

type ListingSchemaFormProps = {
  schema: PlatformListingSchema;
  title: string;
  description: string;
  price: string;
  fields: StructuredFields;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onFieldsChange: (fields: StructuredFields) => void;
  onSubmit: (e: FormEvent) => void;
  footer: ReactNode;
  onRewriteDescription?: () => void;
  rewritingDescription?: boolean;
};

function SyncedAtLabel({ syncedAt }: { syncedAt: string }) {
  let text = syncedAt;
  try {
    text = new Date(syncedAt).toLocaleString();
  } catch {
    /* keep iso */
  }
  return (
    <span suppressHydrationWarning>
      {" · last synced "}
      {text}
    </span>
  );
}

function readStructured(
  fields: StructuredFields,
  key: string
): string {
  const value = (fields as Record<string, unknown>)[key];
  if (Array.isArray(value)) return value.join(", ");
  if (value == null) return "";
  return String(value);
}

function writeStructured(
  fields: StructuredFields,
  key: string,
  raw: string,
  input: ListingFieldDef["input"]
): StructuredFields {
  const next = { ...fields } as StructuredFields & Record<string, unknown>;
  if (key === "styleTags" || input === "tags") {
    next[key] = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return next;
  }
  if (key === "originalPrice") {
    next[key] = raw === "" ? null : Number(raw);
    return next;
  }
  next[key] = raw === "" ? null : raw;
  return next;
}

export function ListingSchemaForm({
  schema,
  title,
  description,
  price,
  fields,
  onTitleChange,
  onDescriptionChange,
  onPriceChange,
  onFieldsChange,
  onSubmit,
  footer,
  onRewriteDescription,
  rewritingDescription = false,
}: ListingSchemaFormProps) {
  const fieldNodes = useMemo(() => schema.fields, [schema.fields]);
  const categoryOptions = useMemo(() => {
    const fromSchema = schema.fields.find((f) => f.id === "category")?.options;
    if (fromSchema?.length) return fromSchema;
    return getMarketplaceCategoryOptions(schema.platform);
  }, [schema.fields, schema.platform]);

  const subcategoryOptions = useMemo(
    () =>
      getMarketplaceSubcategoryOptions(schema.platform, fields.category),
    [schema.platform, fields.category]
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-base text-[var(--muted)]">
        Fields mirror the {schema.platform === "mercari" ? "Mercari" : "Poshmark"}{" "}
        sell form
        {schema.source === "extension" && schema.syncedAt ? (
          <SyncedAtLabel syncedAt={schema.syncedAt} />
        ) : (
          " · using built-in clothing listing layout"
        )}
        . Category choices match the marketplace. Open the sell page with the
        Chrome extension and tap{" "}
        <span className="font-semibold text-[var(--foreground)]">
          Sync form fields
        </span>{" "}
        if other fields change.
      </p>

      {fieldNodes.map((field) => {
        const label = `${field.label}${field.required ? "" : " (optional)"}`;

        if (field.source === "title") {
          return (
            <Field key={field.id} label={`${label} (${title.length}/${field.maxLength ?? 80})`} hint={field.hint}>
              <input
                value={title}
                maxLength={field.maxLength}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={field.placeholder}
                className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
              />
            </Field>
          );
        }

        if (field.source === "description") {
          return (
            <div key={field.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-base font-semibold text-[var(--foreground)]">
                  {`${label} (${description.length}/${field.maxLength ?? 5000})`}
                </span>
                {onRewriteDescription ? (
                  <button
                    type="button"
                    disabled={rewritingDescription}
                    onClick={onRewriteDescription}
                    className="touch-target rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-base font-semibold text-[var(--foreground)] disabled:opacity-50"
                  >
                    {rewritingDescription
                      ? "Rewriting…"
                      : "Rewrite with AI"}
                  </button>
                ) : null}
              </div>
              {field.hint ? (
                <span className="text-sm text-[var(--muted)]">{field.hint}</span>
              ) : null}
              <textarea
                value={description}
                maxLength={field.maxLength}
                onChange={(e) => onDescriptionChange(e.target.value)}
                rows={8}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-lg leading-relaxed"
              />
            </div>
          );
        }

        if (field.source === "price") {
          return (
            <Field key={field.id} label={label} hint={field.hint}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => onPriceChange(e.target.value)}
                className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
              />
            </Field>
          );
        }

        const key = structuredKey(field.source);
        if (!key) return null;
        const value = readStructured(fields, key);

        if (field.id === "category") {
          const options =
            field.options?.length ? field.options : categoryOptions;
          return (
            <Field key={field.id} label={label} hint={field.hint}>
              <select
                value={value}
                onChange={(e) => {
                  const nextCategory = e.target.value;
                  let next = writeStructured(
                    fields,
                    key,
                    nextCategory,
                    "select"
                  );
                  const allowed = getMarketplaceSubcategoryOptions(
                    schema.platform,
                    nextCategory || null
                  );
                  if (
                    next.subcategory &&
                    !allowed.includes(next.subcategory)
                  ) {
                    next = { ...next, subcategory: null };
                  }
                  onFieldsChange(next);
                }}
                className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
              >
                <option value="">Select…</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          );
        }

        if (field.id === "subcategory") {
          const options = subcategoryOptions.length
            ? subcategoryOptions
            : field.options ?? [];
          return (
            <Field key={field.id} label={label} hint={field.hint}>
              <select
                value={value}
                disabled={!fields.category || options.length === 0}
                onChange={(e) =>
                  onFieldsChange(
                    writeStructured(fields, key, e.target.value, "select")
                  )
                }
                className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg disabled:opacity-50"
              >
                <option value="">
                  {!fields.category
                    ? "Select a category first…"
                    : options.length === 0
                      ? "No subcategories"
                      : "Select…"}
                </option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          );
        }

        if (field.input === "select" && field.options?.length) {
          return (
            <Field key={field.id} label={label} hint={field.hint}>
              <select
                value={value}
                onChange={(e) =>
                  onFieldsChange(
                    writeStructured(fields, key, e.target.value, field.input)
                  )
                }
                className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
              >
                <option value="">Select…</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          );
        }

        if (field.input === "textarea") {
          return (
            <Field key={field.id} label={label} hint={field.hint}>
              <textarea
                value={value}
                maxLength={field.maxLength}
                onChange={(e) =>
                  onFieldsChange(
                    writeStructured(fields, key, e.target.value, field.input)
                  )
                }
                rows={4}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-lg"
              />
            </Field>
          );
        }

        return (
          <Field key={field.id} label={label} hint={field.hint}>
            <input
              type={field.input === "number" ? "number" : "text"}
              value={value}
              maxLength={field.maxLength}
              onChange={(e) =>
                onFieldsChange(
                  writeStructured(fields, key, e.target.value, field.input)
                )
              }
              placeholder={
                field.input === "tags"
                  ? "Comma-separated tags"
                  : field.placeholder
              }
              className="touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 text-lg"
            />
          </Field>
        );
      })}

      {footer}
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-base font-semibold text-[var(--foreground)]">
        {label}
      </span>
      {hint ? <span className="text-sm text-[var(--muted)]">{hint}</span> : null}
      {children}
    </label>
  );
}
