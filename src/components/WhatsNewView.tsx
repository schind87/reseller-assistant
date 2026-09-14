"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { WhatsNewItem, WhatsNewScreenshot } from "@/content/whats-new";

type WhatsNewViewProps = {
  items: WhatsNewItem[];
  storeStatus?: { label: string; tone: "accent" | "danger" } | null;
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

function StoreStatusChip({
  status,
}: {
  status: { label: string; tone: "accent" | "danger" };
}) {
  return (
    <span
      role="status"
      translate="no"
      className={
        status.tone === "danger"
          ? "max-w-full break-words rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-800"
          : "max-w-full break-words rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--accent)]"
      }
    >
      {status.label}
    </span>
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
      {groups.map((group) => (
        <section key={group.date} className="flex flex-col gap-6">
          <h2 className="text-base font-semibold text-[var(--accent)]">
            {formatNoteDate(group.date)}
          </h2>
          {group.items.map((item) => (
            <article key={item.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 break-words font-[family-name:var(--font-brand)] text-2xl text-[var(--foreground)]">
                  {item.title}
                </h3>
                {item.helper ? (
                  <>
                    <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                      Chrome helper
                    </span>
                    {storeStatus && item.id === firstHelperId ? (
                      <StoreStatusChip status={storeStatus} />
                    ) : null}
                  </>
                ) : null}
              </div>
              <p className="text-base text-[var(--foreground)]">{item.body}</p>
              {item.bullets && item.bullets.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-base text-[var(--foreground)]">
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {item.screenshots && item.screenshots.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {item.screenshots.map((screenshot) => (
                    <li key={screenshot.src}>
                      <button
                        type="button"
                        className="touch-target text-left text-base font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        onClick={(event) =>
                          openScreenshot(screenshot, event.currentTarget)
                        }
                      >
                        {screenshot.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </section>
      ))}

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
