"use client";

import { useEffect, useState } from "react";

type ExtensionInstallCardProps = {
  compact?: boolean;
};

export function ExtensionInstallCard({ compact = false }: ExtensionInstallCardProps) {
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocal(host === "localhost" || host === "127.0.0.1");
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <h2 className="font-[family-name:var(--font-brand)] text-2xl">
        Chrome extension
      </h2>
      <p className="mt-2 text-base text-[var(--muted)]">
        {compact
          ? "Install on your computer to fill Mercari and Poshmark fields from this draft. Opening this page pairs automatically when the extension is loaded."
          : "Download the helper for your computer. It fills Mercari and Poshmark listing fields from your draft — you still press Publish yourself. The Post checklist pairs the extension automatically when it is installed."}
      </p>
      <a
        href="/api/extension/download"
        className="mt-4 inline-flex touch-target w-full items-center justify-center rounded-xl border border-transparent bg-[var(--accent)] px-6 py-4 text-lg font-semibold text-white hover:bg-[var(--accent-hover)]"
      >
        Download Chrome extension
      </a>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-base text-[var(--muted)]">
        {isLocal ? (
          <>
            <li>
              In this repo run{" "}
              <span className="font-semibold text-[var(--foreground)]">
                npm run extension:live
              </span>
              .
            </li>
            <li>
              Open{" "}
              <span className="font-semibold text-[var(--foreground)]">
                chrome://extensions
              </span>{" "}
              and turn on Developer mode.
            </li>
            <li>
              Click{" "}
              <span className="font-semibold text-[var(--foreground)]">
                Load unpacked
              </span>{" "}
              and choose the repo folder{" "}
              <span className="font-semibold text-[var(--foreground)]">
                extension-live
              </span>
              .
            </li>
            <li>
              After pulling code, run{" "}
              <span className="font-semibold text-[var(--foreground)]">
                npm run extension:live
              </span>{" "}
              again, then tap{" "}
              <span className="font-semibold text-[var(--foreground)]">
                Reload extension
              </span>{" "}
              at the bottom of the side panel.
            </li>
          </>
        ) : (
          <>
            <li>Unzip the download on your computer.</li>
            <li>
              Open{" "}
              <span className="font-semibold text-[var(--foreground)]">
                chrome://extensions
              </span>{" "}
              and turn on Developer mode.
            </li>
            <li>
              Click{" "}
              <span className="font-semibold text-[var(--foreground)]">
                Load unpacked
              </span>{" "}
              and choose the unzipped{" "}
              <span className="font-semibold text-[var(--foreground)]">
                reseller-assistant-extension
              </span>{" "}
              folder.
            </li>
          </>
        )}
      </ol>
    </section>
  );
}
