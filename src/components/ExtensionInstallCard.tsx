"use client";

type ExtensionInstallCardProps = {
  compact?: boolean;
};

export function ExtensionInstallCard({ compact = false }: ExtensionInstallCardProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <h2 className="font-[family-name:var(--font-brand)] text-2xl">
        Chrome extension
      </h2>
      <p className="mt-2 text-base text-[var(--muted)]">
        {compact
          ? "Install on your computer to fill Mercari and Poshmark fields from this draft."
          : "Download the helper for your computer. It fills Mercari and Poshmark listing fields from your draft — you still press Publish yourself."}
      </p>
      <a
        href="/api/extension/download"
        className="mt-4 inline-flex touch-target w-full items-center justify-center rounded-xl border border-transparent bg-[var(--accent)] px-6 py-4 text-lg font-semibold text-white hover:bg-[var(--accent-hover)]"
      >
        Download Chrome extension
      </a>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-base text-[var(--muted)]">
        <li>Unzip the download on your computer.</li>
        <li>
          Open{" "}
          <span className="font-semibold text-[var(--foreground)]">
            chrome://extensions
          </span>{" "}
          and turn on Developer mode.
        </li>
        <li>
          Click <span className="font-semibold text-[var(--foreground)]">Load unpacked</span>{" "}
          and choose the unzipped{" "}
          <span className="font-semibold text-[var(--foreground)]">
            reseller-assistant-extension
          </span>{" "}
          folder.
        </li>
      </ol>
    </section>
  );
}
