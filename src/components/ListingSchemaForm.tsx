"use client";

import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { ListingFieldDef, PlatformListingSchema } from "@/lib/listing-schemas";
import { structuredKey } from "@/lib/listing-schemas";
import {
  getMarketplaceCategoryOptions,
  getMarketplaceSubcategoryOptions,
} from "@/lib/marketplace-categories";
import type { StructuredFields } from "@/lib/types";
import { AiGlyph } from "@/components/AiPhotoBackgroundPicker";

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
  /** True after AI has written the description at least once this session / listing. */
  descriptionAiWritten?: boolean;
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
  descriptionAiWritten = false,
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
          <FieldLabel
            label={`${field.label}${field.required ? "" : " (optional)"} (${description.length}/${field.maxLength ?? 5000})`}
            hint={field.hint}
          />
          {onRewriteDescription ? (
            <button
              type="button"
              disabled={rewritingDescription}
              onClick={onRewriteDescription}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50"
            >
              {rewritingDescription
                ? descriptionAiWritten
                  ? "Updating…"
                  : "Writing…"
                : descriptionAiWritten
                  ? "Rewrite"
                  : "Write with AI"}
              {!rewritingDescription ? (
                <AiGlyph className="h-3.5 w-3.5 text-[var(--accent)]" />
              ) : null}
            </button>
          ) : null}
        </div>
        <textarea
          value={description}
          maxLength={field.maxLength}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={20}
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
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<number | null>(null);
  const selectedSet = useMemo(
    () => new Set(selected.map((tag) => tag.toLowerCase())),
    [selected]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter(
        (option) =>
          option.toLowerCase().includes(q) &&
          !selectedSet.has(option.toLowerCase())
      )
      .slice(0, 12);
  }, [options, query, selectedSet]);

  const showDropdown =
    open && query.trim().length > 0 && selected.length < max;

  function clearBlurTimer() {
    if (blurTimer.current != null) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }

  function addTag(tag: string) {
    const key = tag.toLowerCase();
    if (selectedSet.has(key) || selected.length >= max) return;
    onChange([...selected, tag]);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  }

  function removeTag(tag: string) {
    onChange(selected.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      removeTag(selected[selected.length - 1]!);
      return;
    }
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIndex] ?? filtered[0];
      if (pick) addTag(pick);
    }
  }

  return (
    <div className="flex flex-col gap-2" title={hint}>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
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

      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={selected.length >= max}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            clearBlurTimer();
            if (query.trim()) setOpen(true);
          }}
          onBlur={() => {
            clearBlurTimer();
            blurTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            selected.length >= max
              ? `Maximum ${max} tags — remove one to add another`
              : "Type to find a Poshmark style tag…"
          }
          className={`${controlClass} disabled:opacity-60`}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
        />

        {showDropdown ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-[var(--border)] bg-white shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[var(--muted)]">
                No matching tags
              </p>
            ) : (
              <ul role="listbox">
                {filtered.map((option, index) => (
                  <li key={option} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addTag(option)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full px-3 py-2 text-left text-sm text-[var(--foreground)] ${
                        index === activeIndex
                          ? "bg-[var(--surface-muted)] font-semibold"
                          : "hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-[var(--muted)]">
        {selected.length}/{max} selected · type to choose from Poshmark’s list
      </p>
    </div>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]">
      <span>{label}</span>
      {hint ? <FieldHelp text={hint} /> : null}
    </span>
  );
}

function FieldHelp({ text }: { text: string }) {
  return (
    <span className="group/help relative inline-flex shrink-0">
      <span
        tabIndex={0}
        aria-label={text}
        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-[var(--border)] text-[9px] font-semibold leading-none text-[var(--muted)] outline-none hover:border-[var(--muted)] hover:text-[var(--foreground)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-left text-xs font-normal leading-snug text-[var(--foreground)] opacity-0 shadow-lg transition-opacity group-hover/help:opacity-100 group-focus-within/help:opacity-100 sm:w-72"
      >
        {text}
      </span>
    </span>
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
      <FieldLabel label={label} hint={hint} />
      {children}
    </div>
  );
}
