"use client";

/**
 * Always-visible Chrome helper download for Profile.
 * The zip is available even if the helper is already installed.
 */
export function ExtensionInstallCard() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-[family-name:var(--font-brand)] text-2xl">
        Chrome helper
      </h2>
      <p className="text-base text-[var(--muted)]">
        Fills Mercari and Poshmark sell forms from your listing. You still press
        Publish.
      </p>
      <a
        href="/api/extension/download"
        className="text-base font-semibold text-[var(--accent)] hover:underline"
      >
        Download Chrome extension
      </a>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
        <li>Unzip the download (on Mac, double-click the zip in Finder).</li>
        <li>
          chrome://extensions → Developer mode → Load unpacked → select the{" "}
          <span className="font-semibold text-[var(--foreground)]">
            reseller-assistant-extension
          </span>{" "}
          folder (the one that contains{" "}
          <span className="font-semibold text-[var(--foreground)]">
            manifest.json
          </span>
          ).
        </li>
      </ol>
    </section>
  );
}
