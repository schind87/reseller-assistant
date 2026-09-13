"use client";

import { useState, type FormEvent } from "react";
import type { AdminUserShopLink } from "@/lib/admin-users";
import {
  checkClosetWithExtension,
  detectExtensionPresent,
} from "@/lib/extension-bridge";
import {
  closetCheckHint,
  closetUsernameParseError,
  marketplaceClosetUrl,
  parseMarketplaceUsername,
} from "@/lib/marketplace-profiles";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { SUPPORTED_SELLING_WEBSITES } from "@/lib/seller-preferences";
import type { Platform } from "@/lib/types";

type ClosetResponse = {
  shopLinks?: AdminUserShopLink[];
  error?: string;
};

function emptyLink(
  platform: Platform,
  username: string
): AdminUserShopLink {
  return {
    platform,
    username,
    lastCheckedAt: null,
    lastCheckError: null,
  };
}

type AdminUserShopLinksProps = {
  userId: string;
  userLabel: string;
  shopLinks: AdminUserShopLink[];
  onShopLinksChange: (shopLinks: AdminUserShopLink[]) => void;
};

function linkFor(
  shopLinks: AdminUserShopLink[],
  platform: Platform
): AdminUserShopLink | null {
  return shopLinks.find((link) => link.platform === platform) ?? null;
}

export function AdminUserShopLinks({
  userId,
  userLabel,
  shopLinks,
  onShopLinksChange,
}: AdminUserShopLinksProps) {
  const [drafts, setDrafts] = useState<Record<Platform, string>>(() => ({
    mercari: linkFor(shopLinks, "mercari")?.username ?? "",
    poshmark: linkFor(shopLinks, "poshmark")?.username ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<Platform | null>(null);
  const [unlinking, setUnlinking] = useState<Platform | null>(null);
  const [checking, setChecking] = useState<Platform | null>(null);

  async function handleLink(platform: Platform, event: FormEvent) {
    event.preventDefault();
    const username = parseMarketplaceUsername(platform, drafts[platform]);
    if (!username) {
      setError(closetUsernameParseError(platform));
      return;
    }

    setLinking(platform);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/closet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, username }),
      });
      const json = (await res.json().catch(() => ({}))) as ClosetResponse;
      if (!res.ok) {
        throw new Error(json.error ?? "Could not link closet");
      }
      const next = json.shopLinks ?? [
        ...shopLinks.filter((link) => link.platform !== platform),
        emptyLink(platform, username),
      ];
      onShopLinksChange(next);
      setDrafts((prev) => ({ ...prev, [platform]: username }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link closet");
    } finally {
      setLinking(null);
    }
  }

  async function handleUnlink(platform: Platform) {
    const account = linkFor(shopLinks, platform);
    const handle = account ? `@${account.username}` : PLATFORM_LABELS[platform];
    const confirmed = window.confirm(
      `Unlink this ${PLATFORM_LABELS[platform]} closet (${handle}) from ${userLabel}?`
    );
    if (!confirmed) return;

    setUnlinking(platform);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users/${userId}/closet?platform=${encodeURIComponent(platform)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as ClosetResponse;
      if (!res.ok) {
        throw new Error(json.error ?? "Could not unlink closet");
      }
      const next =
        json.shopLinks ??
        shopLinks.filter((link) => link.platform !== platform);
      onShopLinksChange(next);
      setDrafts((prev) => ({ ...prev, [platform]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlink closet");
    } finally {
      setUnlinking(null);
    }
  }

  async function handleCheckListings(platform: Platform) {
    const account = linkFor(shopLinks, platform);
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
        await fetch(`/api/admin/users/${userId}/closet`, {
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

      const res = await fetch(`/api/admin/users/${userId}/closet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          listings: result.listings,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as ClosetResponse;
      if (!res.ok) {
        throw new Error(json.error ?? "Could not save closet listings");
      }
      if (json.shopLinks) onShopLinksChange(json.shopLinks);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not check listings"
      );
    } finally {
      setChecking(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Linked closets
      </h2>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {error}
        </p>
      ) : null}
      {SUPPORTED_SELLING_WEBSITES.map((platform) => {
        const account = linkFor(shopLinks, platform);
        const inputId = `admin-user-${userId}-${platform}-closet`;
        const busy =
          linking === platform ||
          unlinking === platform ||
          checking === platform;
        return (
          <div key={platform} className="flex flex-col gap-2">
            <p className="text-base font-semibold text-[var(--foreground)]">
              {PLATFORM_LABELS[platform]}
            </p>
            {account ? (
              <>
                <p className="text-base text-[var(--foreground)]">
                  Linked as{" "}
                  <span className="font-semibold">@{account.username}</span>
                  {account.lastCheckedAt ? (
                    <span
                      className="text-[var(--muted)]"
                      suppressHydrationWarning
                    >
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
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCheckListings(platform)}
                    className="text-sm font-semibold text-[var(--accent)] hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    aria-label={`Check ${PLATFORM_LABELS[platform]} listings for ${userLabel}`}
                  >
                    {checking === platform ? "Checking…" : "Check listings"}
                  </button>
                  <a
                    href={marketplaceClosetUrl(platform, account.username)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    Open closet
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleUnlink(platform)}
                    className="text-sm font-semibold text-[var(--danger)] hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]"
                    aria-label={`Unlink ${PLATFORM_LABELS[platform]} closet from ${userLabel}`}
                  >
                    {unlinking === platform ? "Unlinking…" : "Unlink"}
                  </button>
                </div>
              </>
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => void handleLink(platform, event)}
              >
                <label htmlFor={inputId} className="grid gap-1">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {platform === "poshmark"
                      ? "Poshmark closet name"
                      : "Mercari username"}
                  </span>
                  <input
                    id={inputId}
                    name={`${platform}-closet-username`}
                    value={drafts[platform]}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [platform]: event.target.value,
                      }))
                    }
                    className="min-h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    placeholder={
                      platform === "poshmark"
                        ? "closet name or poshmark.com/closet/…"
                        : "username or mercari.com/u/…"
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !drafts[platform].trim()}
                  className="self-start text-sm font-semibold text-[var(--accent)] hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {linking === platform
                    ? "Saving…"
                    : `Link ${PLATFORM_LABELS[platform]} closet`}
                </button>
              </form>
            )}
          </div>
        );
      })}
    </section>
  );
}
