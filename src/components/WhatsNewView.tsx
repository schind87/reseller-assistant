"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { WhatsNewItem, WhatsNewScreenshot } from "@/content/whats-new";

type StoreStatus = { label: string; tone: "accent" | "danger" };

type WhatsNewViewProps = {
  items: WhatsNewItem[];
  storeStatus?: StoreStatus | null;
};

function formatNoteDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function groupByDate(items: WhatsNewItem[]): { date: string; items: WhatsNewItem[] }[] {
  const groups: { date: string; items: WhatsNewItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) {
      last.items.push(item);
    } else {
      groups.push({ date: item.date, items: [item] });
    }
  }
  return groups;
}

function HelperMark() {
  return (
    <span className="shrink-0 rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
      Chrome helper
    </span>
  );
}

function StoreStatusWell({ status }: { status: StoreStatus }) {
  return (
    <p
      role="status"
      translate="no"
      className={
        status.tone === "danger"
          ? "rounded-xl bg-red-50 px-4 py-3 text-base text-red-800"
          : "rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-base text-[var(--accent)]"
      }
    >
      {status.label}
    </p>
  );
}

function ScreenshotWell({
  screenshot,
  onOpen,
}: {
  screenshot: WhatsNewScreenshot;
  onOpen: (screenshot: WhatsNewScreenshot, trigger: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-[8.5rem] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-left hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      onClick={(event) => onOpen(screenshot, event.currentTarget)}
    >
      <span className="block h-20 w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshot.src}
          alt={screenshot.alt}
          width={272}
          height={160}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </span>
      <span className="px-2 py-2 text-sm font-semibold text-[var(--accent)]">
        {screenshot.label}
      </span>
    </button>
  );
}

export function WhatsNewView({ items, storeStatus = null }: WhatsNewViewProps) {
  const [open, setOpen] = useState<WhatsNewScreenshot | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function openScreenshot(
    screenshot: WhatsNewScreenshot,
    trigger: HTMLButtonElement
  ) {
    triggerRef.current = trigger;
    setOpen(screenshot);
  }

  function closeScreenshot() {
    setOpen(null);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    trigger?.focus();
  }

  const sorted = items.toSorted((a, b) => b.date.localeCompare(a.date));
  const firstHelperId = sorted.find((item) => item.helper)?.id;
  const groups = groupByDate(sorted);

  return (
    <>
      {groups.map((group) => {
        const dateId = `whats-new-${group.date}`;
        return (
          <section
            key={group.date}
            aria-labelledby={dateId}
            className="flex flex-col gap-3"
          >
            <p
              id={dateId}
              className="text-sm font-semibold text-[var(--muted)]"
            >
              {formatNoteDate(group.date)}
            </p>
            <ul className="flex flex-col gap-3">
              {group.items.map((item) => (
                <li key={item.id}>
                  <article className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 break-words font-[family-name:var(--font-brand)] text-2xl text-[var(--foreground)]">
                        {item.title}
                      </h2>
                      {item.helper ? <HelperMark /> : null}
                    </div>
                    {storeStatus && item.id === firstHelperId ? (
                      <StoreStatusWell status={storeStatus} />
                    ) : null}
                    <p className="text-base text-[var(--foreground)]">{item.body}</p>
                    {item.bullets && item.bullets.length > 0 ? (
                      <ul className="list-disc space-y-2 pl-5 text-base text-[var(--foreground)]">
                        {item.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                    {item.screenshots && item.screenshots.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {item.screenshots.map((screenshot) => (
                          <li key={screenshot.src}>
                            <ScreenshotWell
                              screenshot={screenshot}
                              onOpen={openScreenshot}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {open ? (
        <ScreenshotLightbox screenshot={open} onClose={closeScreenshot} />
      ) : null}
    </>
  );
}

function ScreenshotLightbox({
  screenshot,
  onClose,
}: {
  screenshot: WhatsNewScreenshot;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 touch-target rounded-xl bg-white/95 px-4 text-base font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Close
      </button>
      <div
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshot.src}
          alt={screenshot.alt}
          className="max-h-[min(85vh,900px)] max-w-[min(96vw,900px)] rounded-lg object-contain shadow-2xl"
        />
        <p
          id={titleId}
          className="rounded-lg bg-black/50 px-3 py-1 text-sm font-medium text-white"
        >
          {screenshot.label}
        </p>
      </div>
    </div>
  );
}
