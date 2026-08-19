"use client";

import { useEffect, useState } from "react";
import {
  detectExtensionPresent,
  readCachedExtensionPresent,
} from "@/lib/extension-bridge";

type ExtensionInstallCardProps = {
  compact?: boolean;
};

/**
 * Hidden when the Chrome extension is installed.
 * When missing, shows a collapsed hint instead of a prominent install card.
 */
export function ExtensionInstallCard({
  compact = false,
}: ExtensionInstallCardProps) {
  const [status, setStatus] = useState<"checking" | "installed" | "missing">(
    () => (readCachedExtensionPresent() === true ? "installed" : "checking")
  );
  const [expanded, setExpanded] = useState(false);
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocal(host === "localhost" || host === "127.0.0.1");

    let cancelled = false;
    void detectExtensionPresent().then((present) => {
      if (!cancelled) setStatus(present ? "installed" : "missing");
    });

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (
        data?.source === "reseller-assistant-extension" &&
        (data.type === "bridge-ready" || data.type === "pair-ack")
      ) {
        setStatus("installed");
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, []);

  if (status === "checking" || status === "installed") {
    return null;
  }

  return (
    <section className="rounded-xl border border-dashed border-[var(--border)] bg-transparent px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <span className="text-sm text-[var(--muted)]">
          {compact
            ? "Optional: Chrome helper for Mercari / Poshmark"
            : "Optional: install the Chrome helper"}
        </span>
        <span className="text-sm font-semibold text-[var(--accent)]">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm text-[var(--muted)]">
            Fills sell-form fields and can attach listing photos. You still press
            Publish yourself.
          </p>
          <a
            href="/api/extension/download"
            className="inline text-sm font-normal text-[var(--accent)] underline underline-offset-2 hover:opacity-80"
          >
            Download Chrome extension
          </a>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
            {isLocal ? (
              <>
                <li>
                  Run{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    npm run extension:live
                  </span>
                  , then Load unpacked →{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    extension-live
                  </span>
                  .
                </li>
                <li>
                  After code changes, sync and tap Reload extension in the side
                  panel.
                </li>
              </>
            ) : (
              <>
                <li>
                  Unzip the download (on Mac, double-click the zip in Finder).
                </li>
                <li>
                  chrome://extensions → Developer mode → Load unpacked → select
                  the{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    reseller-assistant-extension
                  </span>{" "}
                  folder (the one that contains{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    manifest.json
                  </span>
                  ).
                </li>
              </>
            )}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
