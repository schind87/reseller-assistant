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

const controlClass =
  "min-h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)]";

function SyncedAtLabel({ syncedAt }: { syncedAt: string }) {
  let text = syncedAt;
  try {
    text = new Date(syncedAt).toLocaleString();
  } catch {
    /* keep iso */
  }
  return (
    <span suppressHydrationWarning>
      {" · synced "}
      {text}
    </span>
  );
}

function readStructured(fields: StructuredFields, key: string): string {
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
    () => getMarketplaceSubcategoryOptions(schema.platform, fields.category),
    [schema.platform, fields.category]
  );

  function renderStructuredField(field: ListingFieldDef) {
    const label = `${field.label}${field.required ? "" : " (optional)"}`;
    const key = structuredKey(field.source);
    if (!key) return null;
    const value = readStructured(fields, key);

    if (field.id === "category") {
      const options = field.options?.length ? field.options : categoryOptions;
      return (
        <Field key={field.id} label={label} hint={field.hint}>
          <select
            value={value}
            title={field.hint}
            onChange={(e) => {
              const nextCategory = e.target.value;
              let next = writeStructured(fields, key, nextCategory, "select");
              const allowed = getMarketplaceSubcategoryOptions(
                schema.platform,
                nextCategory || null
              );
              if (next.subcategory && !allowed.includes(next.subcategory)) {
                next = { ...next, subcategory: null };
              }
              onFieldsChange(next);
            }}
            className={controlClass}
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
        : (field.options ?? []);
      return (
        <Field key={field.id} label={label} hint={field.hint}>
          <select
            value={value}
            title={field.hint}
            disabled={!fields.category || options.length === 0}
            onChange={(e) =>
              onFieldsChange(
                writeStructured(fields, key, e.target.value, "select")
              )
            }
            className={`${controlClass} disabled:opacity-50`}
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
            title={field.hint}
            onChange={(e) =>
              onFieldsChange(
                writeStructured(fields, key, e.target.value, field.input)
              )
            }
            className={controlClass}
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
        <Field
          key={field.id}
          label={label}
          hint={field.hint}
          className="sm:col-span-2"
        >
          <textarea
            value={value}
            title={field.hint}
            maxLength={field.maxLength}
            onChange={(e) =>
              onFieldsChange(
                writeStructured(fields, key, e.target.value, field.input)
              )
            }
            rows={3}
            className={`${controlClass} min-h-0 py-2 leading-snug`}
          />
        </Field>
      );
    }

    return (
      <Field key={field.id} label={label} hint={field.hint}>
        <input
          type={field.input === "number" ? "number" : "text"}
          value={value}
          title={field.hint}
          maxLength={field.maxLength}
          onChange={(e) =>
            onFieldsChange(
              writeStructured(fields, key, e.target.value, field.input)
            )
          }
          placeholder={
            field.input === "tags" ? "Comma-separated tags" : field.placeholder
          }
          className={controlClass}
        />
      </Field>
    );
  }

  const titleField = fieldNodes.find((f) => f.source === "title");
  const descriptionField = fieldNodes.find((f) => f.source === "description");
  const priceField = fieldNodes.find((f) => f.source === "price");
  const otherFields = fieldNodes.filter(
    (f) =>
      f.source !== "title" &&
      f.source !== "description" &&
      f.source !== "price"
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
        Mirrors the {schema.platform === "mercari" ? "Mercari" : "Poshmark"}{" "}
        sell form
        {schema.source === "extension" && schema.syncedAt ? (
          <SyncedAtLabel syncedAt={schema.syncedAt} />
        ) : (
          " · built-in clothing layout"
        )}
        . Use{" "}
        <span className="font-semibold text-[var(--foreground)]">
          Sync form fields
        </span>{" "}
        in the extension if the marketplace form changes.
      </p>

      {titleField ? (
        <Field
          label={`${titleField.label}${titleField.required ? "" : " (optional)"} (${title.length}/${titleField.maxLength ?? 80})`}
          hint={titleField.hint}
        >
          <input
            value={title}
            title={titleField.hint}
            maxLength={titleField.maxLength}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={titleField.placeholder}
            className={controlClass}
          />
        </Field>
      ) : null}

      {descriptionField ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {`${descriptionField.label}${descriptionField.required ? "" : " (optional)"} (${description.length}/${descriptionField.maxLength ?? 5000})`}
            </span>
            {onRewriteDescription ? (
              <button
                type="button"
                disabled={rewritingDescription}
                onClick={onRewriteDescription}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50"
              >
                {rewritingDescription ? "Rewriting…" : "Rewrite with AI"}
              </button>
            ) : null}
          </div>
          <textarea
            value={description}
            title={descriptionField.hint}
            maxLength={descriptionField.maxLength}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={5}
            placeholder={descriptionField.placeholder}
            className={`${controlClass} min-h-0 py-2 leading-snug`}
          />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {priceField ? (
          <Field
            label={`${priceField.label}${priceField.required ? "" : " (optional)"}`}
            hint={priceField.hint}
          >
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              title={priceField.hint}
              onChange={(e) => onPriceChange(e.target.value)}
              className={controlClass}
            />
          </Field>
        ) : null}
        {otherFields.map((field) => renderStructuredField(field))}
      </div>

      {footer}
    </form>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`.trim()}>
      <span className="text-sm font-semibold text-[var(--foreground)]" title={hint}>
        {label}
      </span>
      {children}
    </label>
  );
}
