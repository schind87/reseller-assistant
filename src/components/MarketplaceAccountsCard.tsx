"use client";

import { useState, type FormEvent } from "react";
import { BigButton } from "@/components/BigButton";
import {
  checkClosetWithExtension,
  detectClosetUsernameWithExtension,
  detectExtensionPresent,
} from "@/lib/extension-bridge";
import {
  closetCheckHint,
  closetFindHint,
  closetLinkConfirmMessage,
  closetStatusLabel,
  marketplaceClosetUrl,
  parseMarketplaceUsername,
  type MarketplaceAccount,
  type MarketplaceClosetItem,
} from "@/lib/marketplace-profiles";
import { PLATFORM_LABELS, PLATFORM_PHOTO_ASPECT } from "@/lib/platforms";
import { SUPPORTED_SELLING_WEBSITES } from "@/lib/seller-preferences";
import type { Platform } from "@/lib/types";

type ClosetPayload = {
  accounts: MarketplaceAccount[];
  listings: MarketplaceClosetItem[];
  error?: string;
};

type MarketplaceAccountsCardProps = {
  initialAccounts?: MarketplaceAccount[];
  initialListings?: MarketplaceClosetItem[];
};

function formatPrice(price: number | null): string | null {
  if (price == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function accountFor(
  accounts: MarketplaceAccount[],
  platform: Platform
): MarketplaceAccount | null {
  return accounts.find((account) => account.platform === platform) ?? null;
}

export function MarketplaceAccountsCard({
  initialAccounts = [],
  initialListings = [],
}: MarketplaceAccountsCardProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [listings, setListings] = useState(initialListings);
  const [drafts, setDrafts] = useState<Record<Platform, string>>(() => ({
    mercari: accountFor(initialAccounts, "mercari")?.username ?? "",
    poshmark: accountFor(initialAccounts, "poshmark")?.username ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<Platform | null>(null);
  const [finding, setFinding] = useState<Platform | null>(null);
  const [checking, setChecking] = useState<Platform | null>(null);
  const [unlinking, setUnlinking] = useState<Platform | null>(null);

  function applyPayload(payload: ClosetPayload) {
    setAccounts(payload.accounts);
    setListings(payload.listings);
    setDrafts((prev) => ({
      mercari:
        accountFor(payload.accounts, "mercari")?.username ?? prev.mercari,
      poshmark:
        accountFor(payload.accounts, "poshmark")?.username ?? prev.poshmark,
    }));
  }

  async function saveLinkedUsername(platform: Platform, username: string) {
    setLinking(platform);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/closet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, username }),
      });
      const json = (await res.json()) as ClosetPayload & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not link closet");
      }
      applyPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link closet");
    } finally {
      setLinking(null);
    }
  }

  async function linkCloset(platform: Platform, event: FormEvent) {
    event.preventDefault();
    const username = parseMarketplaceUsername(platform, drafts[platform]);
    if (!username) {
      setError(
        platform === "poshmark"
          ? "Use your Poshmark closet name, or paste the closet URL"
          : "Use your Mercari username, or paste the profile URL"
      );
      return;
    }
    await saveLinkedUsername(platform, username);
  }

  async function findAndLinkCloset(platform: Platform) {
    setFinding(platform);
    setError(null);
    try {
      const present = await detectExtensionPresent();
      if (!present) {
        throw new Error(
          "Install the Chrome helper on this computer, then try Find my closet."
        );
      }

      const result = await detectClosetUsernameWithExtension(platform);
      if (!result.ok || !result.username) {
        throw new Error(
          result.error ||
            (result.loginRequired
              ? closetFindHint(platform)
              : `Could not find your ${PLATFORM_LABELS[platform]} closet`)
        );
      }

      const username = parseMarketplaceUsername(platform, result.username);
      if (!username) {
        throw new Error(`Could not find your ${PLATFORM_LABELS[platform]} closet`);
      }

      setDrafts((prev) => ({ ...prev, [platform]: username }));
      const confirmed = window.confirm(
        closetLinkConfirmMessage(platform, username)
      );
      if (!confirmed) return;
      await saveLinkedUsername(platform, username);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not find closet name"
      );
    } finally {
      setFinding(null);
    }
  }

  async function unlinkCloset(platform: Platform) {
    setUnlinking(platform);
    setError(null);
    try {
      const res = await fetch(
        `/api/marketplace/closet?platform=${encodeURIComponent(platform)}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as ClosetPayload & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not unlink closet");
      }
      applyPayload(json);
      setDrafts((prev) => ({ ...prev, [platform]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink closet");
    } finally {
      setUnlinking(null);
    }
  }

  async function checkListings(platform: Platform) {
    const account = accountFor(accounts, platform);
    if (!account) return;

    setChecking(platform);
    setError(null);
    try {
      const present = await detectExtensionPresent();
      if (!present) {
        throw new Error(
          "Install the Chrome helper on this computer, then try Check listings."
        );
      }

      const result = await checkClosetWithExtension({
        platform,
        username: account.username,
        closetUrl: marketplaceClosetUrl(platform, account.username),
      });

      if (!result.ok) {
        const message =
          result.error ||
          (result.loginRequired
            ? closetCheckHint(platform)
            : `Could not read ${PLATFORM_LABELS[platform]} listings`);
        await fetch("/api/marketplace/closet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            listings: [],
            error: message,
          }),
        }).catch(() => null);
        throw new Error(message);
      }

      const res = await fetch("/api/marketplace/closet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          listings: result.listings,
        }),
      });
      const json = (await res.json()) as ClosetPayload & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not save closet listings");
      }
      applyPayload(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not check listings"
      );
    } finally {
      setChecking(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Linked closets
        </h2>
        <p className="mt-1 text-base text-[var(--muted)]">
          Check what’s live on Mercari and Poshmark from here.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {error}
        </p>
      ) : null}

      {SUPPORTED_SELLING_WEBSITES.map((platform) => {
        const account = accountFor(accounts, platform);
        const storeListings = listings.filter(
          (item) => item.platform === platform
        );
        const aspect = PLATFORM_PHOTO_ASPECT[platform];
        const busy =
          linking === platform ||
          finding === platform ||
          checking === platform ||
          unlinking === platform;

        return (
          <div
            key={platform}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-4"
          >
            <h3 className="font-[family-name:var(--font-brand)] text-xl">
              {PLATFORM_LABELS[platform]}
            </h3>

            {account ? (
              <>
                <p className="text-base text-[var(--foreground)]">
                  Linked as{" "}
                  <span className="font-semibold">@{account.username}</span>
                  {account.lastCheckedAt ? (
                    <span className="text-[var(--muted)]" suppressHydrationWarning>
                      {" "}
                      · Checked{" "}
                      {new Date(account.lastCheckedAt).toLocaleString()}
                    </span>
                  ) : null}
                </p>
                {account.lastCheckError ? (
                  <p className="text-sm text-[var(--danger)]">
                    {account.lastCheckError}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2">
                  <BigButton
                    disabled={busy}
                    onClick={() => void checkListings(platform)}
                  >
                    {checking === platform ? "Checking…" : "Check listings"}
                  </BigButton>
                  <a
                    href={marketplaceClosetUrl(platform, account.username)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="touch-target inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-white px-6 py-4 text-lg font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                  >
                    Open closet
                  </a>
                  <BigButton
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void unlinkCloset(platform)}
                  >
                    {unlinking === platform ? "Unlinking…" : "Unlink"}
                  </BigButton>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <BigButton
                  disabled={busy}
                  onClick={() => void findAndLinkCloset(platform)}
                >
                  {finding === platform
                    ? "Looking…"
                    : `Find my ${PLATFORM_LABELS[platform]} closet`}
                </BigButton>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => void linkCloset(platform, event)}
                >
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {platform === "poshmark"
                        ? "Poshmark closet name"
                        : "Mercari username"}
                    </span>
                    <input
                      name={`${platform}-closet-username`}
                      value={drafts[platform]}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [platform]: event.target.value,
                        }))
                      }
                      className="touch-target w-full rounded-lg border border-[var(--border)] bg-white px-3 text-base"
                      placeholder={
                        platform === "poshmark"
                          ? "closet name or poshmark.com/closet/…"
                          : "username or mercari.com/u/…"
                      }
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <BigButton
                    type="submit"
                    variant="secondary"
                    disabled={busy || !drafts[platform].trim()}
                  >
                    {linking === platform
                      ? "Saving…"
                      : `Link ${PLATFORM_LABELS[platform]} closet`}
                  </BigButton>
                </form>
              </div>
            )}

            {account && storeListings.length === 0 ? (
              <p className="text-base text-[var(--muted)]">
                {account.lastCheckedAt
                  ? `No ${PLATFORM_LABELS[platform]} listings found. ${closetCheckHint(platform)}`
                  : `No ${PLATFORM_LABELS[platform]} listings saved yet. Tap Check listings.`}
              </p>
            ) : null}

            {storeListings.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {storeListings.map((item) => {
                  const label = item.title?.trim() || "Untitled listing";
                  const price = formatPrice(item.price);
                  return (
                    <li
                      key={item.id}
                      className="flex items-stretch overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/40"
                    >
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-stretch gap-3 transition-colors hover:bg-[var(--surface-muted)]"
                      >
                        <div
                          className="h-[4.75rem] shrink-0 self-center overflow-hidden bg-[var(--surface-muted)] sm:ml-3 sm:rounded-xl"
                          style={{
                            aspectRatio: `${aspect.width} / ${aspect.height}`,
                          }}
                        >
                          {item.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              No photo
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1 py-3 pr-3 pl-3 sm:pl-0">
                          <p className="break-words text-base font-semibold text-[var(--foreground)]">
                            {label}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {closetStatusLabel(item.status)}
                            {price ? ` · ${price}` : ""}
                          </p>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
