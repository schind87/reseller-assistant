"use client";

import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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

const STYLE_TAG_MAX = 3;

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

function readStructuredTags(fields: StructuredFields, key: string): string[] {
  const value = (fields as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.map((part) => String(part).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
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
      .filter(Boolean)
      .slice(0, STYLE_TAG_MAX);
    return next;
  }
  if (key === "originalPrice") {
    next[key] = raw === "" ? null : Number(raw);
    return next;
  }
  next[key] = raw === "" ? null : raw;
  return next;
}

function writeStructuredTags(
  fields: StructuredFields,
  key: string,
  tags: string[]
): StructuredFields {
  const next = { ...fields } as StructuredFields & Record<string, unknown>;
  next[key] = tags.slice(0, STYLE_TAG_MAX);
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

  function renderTitleField(field: ListingFieldDef) {
    return (
      <Field
        key={field.id}
        label={`${field.label}${field.required ? "" : " (optional)"} (${title.length}/${field.maxLength ?? 80})`}
        hint={field.hint}
        className="sm:col-span-2"
      >
        <input
          value={title}
          title={field.hint}
          maxLength={field.maxLength}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={field.placeholder}
          className={controlClass}
        />
      </Field>
    );
  }

  function renderDescriptionField(field: ListingFieldDef) {
    return (
      <div key={field.id} className="flex flex-col gap-1 sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {`${field.label}${field.required ? "" : " (optional)"} (${description.length}/${field.maxLength ?? 5000})`}
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
          title={field.hint}
          maxLength={field.maxLength}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={5}
          placeholder={field.placeholder}
          className={`${controlClass} min-h-0 py-2 leading-snug`}
        />
      </div>
    );
  }

  function renderPriceField(field: ListingFieldDef) {
    return (
      <Field
        key={field.id}
        label={`${field.label}${field.required ? "" : " (optional)"}`}
        hint={field.hint}
      >
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          title={field.hint}
          onChange={(e) => onPriceChange(e.target.value)}
          className={controlClass}
        />
      </Field>
    );
  }

  function renderTagsField(field: ListingFieldDef, key: string) {
    const label = `${field.label}${field.required ? "" : " (optional)"}`;
    const selected = readStructuredTags(fields, key);
    const options = field.options?.length ? field.options : [];

    if (!options.length) {
      return (
        <Field key={field.id} label={label} hint={field.hint} className="sm:col-span-2">
          <input
            type="text"
            value={selected.join(", ")}
            title={field.hint}
            onChange={(e) =>
              onFieldsChange(
                writeStructured(fields, key, e.target.value, field.input)
              )
            }
            placeholder="Comma-separated tags"
            className={controlClass}
          />
        </Field>
      );
    }

    return (
      <Field key={field.id} label={label} hint={field.hint} className="sm:col-span-2">
        <StyleTagsPicker
          options={options}
          selected={selected}
          max={STYLE_TAG_MAX}
          hint={field.hint}
          onChange={(next) =>
            onFieldsChange(writeStructuredTags(fields, key, next))
          }
        />
      </Field>
    );
  }

  function renderStructuredField(field: ListingFieldDef) {
    const label = `${field.label}${field.required ? "" : " (optional)"}`;
    const key = structuredKey(field.source);
    if (!key) return null;
    const value = readStructured(fields, key);

    if (field.input === "tags" || field.id === "styleTags") {
      return renderTagsField(field, key);
    }

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
          placeholder={field.placeholder}
          className={controlClass}
        />
      </Field>
    );
  }

  function renderField(field: ListingFieldDef) {
    if (field.source === "title") return renderTitleField(field);
    if (field.source === "description") return renderDescriptionField(field);
    if (field.source === "price") return renderPriceField(field);
    return renderStructuredField(field);
  }

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

      <div className="grid gap-3 sm:grid-cols-2">
        {fieldNodes.map((field) => renderField(field))}
      </div>

      {footer}
    </form>
  );
}

function StyleTagsPicker({
  options,
  selected,
  max,
  hint,
  onChange,
}: {
  options: string[];
  selected: string[];
  max: number;
  hint?: string;
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(
    () => new Set(selected.map((tag) => tag.toLowerCase())),
    [selected]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((option) => option.toLowerCase().includes(q))
      : options;
    return list.slice(0, 80);
  }, [options, query]);

  function toggle(tag: string) {
    const key = tag.toLowerCase();
    if (selectedSet.has(key)) {
      onChange(selected.filter((item) => item.toLowerCase() !== key));
      return;
    }
    if (selected.length >= max) return;
    onChange([...selected, tag]);
  }

  return (
    <div className="flex flex-col gap-2" title={hint}>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-sm font-medium text-[var(--foreground)]"
            >
              {tag}
              <span aria-hidden className="text-[var(--muted)]">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          selected.length >= max
            ? `Maximum ${max} tags — remove one to add another`
            : "Search Poshmark style tags…"
        }
        className={controlClass}
      />

      <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--border)] bg-white">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-[var(--muted)]">No matching tags</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((option) => {
              const isOn = selectedSet.has(option.toLowerCase());
              const disabled = !isOn && selected.length >= max;
              return (
                <li key={option}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(option)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm disabled:opacity-40 ${
                      isOn
                        ? "bg-[var(--surface-muted)] font-semibold text-[var(--foreground)]"
                        : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <span>{option}</span>
                    {isOn ? <span className="text-[var(--muted)]">Selected</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--muted)]">
        {selected.length}/{max} selected · same options as Poshmark create-listing
      </p>
    </div>
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
    <div className={`flex flex-col gap-1 ${className ?? ""}`.trim()}>
      <span className="text-sm font-semibold text-[var(--foreground)]" title={hint}>
        {label}
      </span>
      {children}
    </div>
  );
}
