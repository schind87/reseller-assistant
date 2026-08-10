"use client";

import { useEffect, type FormEvent, type ReactNode } from "react";
import { ListingSchemaForm } from "@/components/ListingSchemaForm";
import type { PlatformListingSchema } from "@/lib/listing-schemas";
import { PLATFORM_LABELS } from "@/lib/platforms";
import type { Platform, StructuredFields } from "@/lib/types";

type ListingTweakDialogProps = {
  platform: Platform;
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
  onRewriteDescription?: () => void;
  rewritingDescription?: boolean;
  descriptionAiWritten?: boolean;
  saving?: boolean;
  draftDirty?: boolean;
  footerExtra?: ReactNode;
  onClose: () => void;
};

export function ListingTweakDialog({
  platform,
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
  onRewriteDescription,
  rewritingDescription = false,
  descriptionAiWritten = false,
  saving = false,
  draftDirty = false,
  footerExtra,
  onClose,
}: ListingTweakDialogProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-tweak-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,960px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
              {PLATFORM_LABELS[platform]}
            </p>
            <h2
              id="listing-tweak-title"
              className="font-[family-name:var(--font-brand)] text-2xl text-[var(--foreground)] sm:text-3xl"
            >
              Tweak listing fields
            </h2>
            <p className="mt-1 text-base text-[var(--muted)]">
              Change any field, save, then return to posting — the extension can
              refresh and fill again.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target shrink-0 rounded-xl border border-[var(--border)] bg-white px-4 text-base font-semibold text-[var(--foreground)]"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <ListingSchemaForm
            schema={schema}
            title={title}
            description={description}
            price={price}
            fields={fields}
            onTitleChange={onTitleChange}
            onDescriptionChange={onDescriptionChange}
            onPriceChange={onPriceChange}
            onFieldsChange={onFieldsChange}
            onRewriteDescription={onRewriteDescription}
            rewritingDescription={rewritingDescription}
            descriptionAiWritten={descriptionAiWritten}
            onSubmit={onSubmit}
            footer={
              <div className="sticky bottom-0 -mx-1 flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-1 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    disabled={saving || rewritingDescription}
                    className="touch-target rounded-xl bg-[var(--accent)] px-5 text-base font-semibold text-white disabled:opacity-60"
                  >
                    {saving
                      ? "Saving…"
                      : draftDirty
                        ? "Save changes"
                        : "Saved"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="touch-target rounded-xl border border-[var(--border)] bg-white px-5 text-base font-semibold text-[var(--foreground)]"
                  >
                    Done
                  </button>
                </div>
                {footerExtra}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
