"use client";

import Link from "next/link";
import { chromeWebStoreUrl } from "@/lib/chrome-web-store";

/**
 * Chrome helper install on Profile. Store listing is the auto-update path;
 * zip remains for Load unpacked.
 */
export function ExtensionInstallCard() {
  const storeUrl = chromeWebStoreUrl();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-[family-name:var(--font-brand)] text-2xl">
        Chrome helper
      </h2>
      <p className="text-base text-[var(--muted)]">
        Fills Mercari and Poshmark sell forms from your listing. You still press
        Publish. Check listings on Profile also uses it to read your closet.
      </p>
      {storeUrl ? (
        <a
          href={storeUrl}
          className="text-base font-semibold text-[var(--accent)] hover:underline"
        >
          Add from the Chrome Web Store
        </a>
      ) : null}
      <a
        href="/api/extension/download"
        className="text-base font-semibold text-[var(--accent)] hover:underline"
      >
        {storeUrl ? "Download zip instead" : "Download Chrome extension"}
      </a>
      {storeUrl ? (
        <p className="text-sm text-[var(--muted)]">
          Chrome updates the Store copy for you. Use the zip only if you load
          unpacked.
        </p>
      ) : (
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
      )}
      <Link
        href="/privacy"
        className="text-sm font-semibold text-[var(--accent)] hover:underline"
      >
        Privacy
      </Link>
    </section>
  );
}
