"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ADMIN_USER_JOB_FILTERS,
  adminUserFiltersToSearch,
  filterAdminUsers,
  formatAdminUserSummary,
  listingJobLabel,
  matchingListings,
  parseAdminUserFilters,
  summarizeAdminUsers,
  type AdminUserFilters,
  type AdminUserRow,
} from "@/lib/admin-users";
import { AdminPhotoR2Copy } from "@/components/AdminPhotoR2Copy";
import { listingJobStepLabel } from "@/lib/listing-job";
import { PLATFORM_LABELS } from "@/lib/platforms";

type AdminUsersConsoleProps = {
  initialUsers: AdminUserRow[];
  currentUserId: string;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function userLabel(user: AdminUserRow): string {
  if (user.email) return user.email;
  if (user.id == null) return "No owner";
  return "No email";
}

function userMeta(user: AdminUserRow): string {
  if (user.id == null) {
    return `${user.listingCount} listing${user.listingCount === 1 ? "" : "s"} · no profile`;
  }
  const bits = [
    `${user.listingCount} listing${user.listingCount === 1 ? "" : "s"}`,
    `${user.postedCount} posted`,
    user.hasPin ? "PIN set" : "No PIN",
    user.prefsCompleted ? "Prefs saved" : "Prefs incomplete",
  ];
  if (user.lastListingAt) {
    bits.push(`Last listing ${formatWhen(user.lastListingAt)}`);
  }
  return bits.join(" · ");
}

export function AdminUsersConsole({
  initialUsers,
  currentUserId,
}: AdminUsersConsoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(
    null
  );

  const filters = useMemo(
    () => parseAdminUserFilters(searchParams),
    [searchParams]
  );

  const filtered = useMemo(
    () => filterAdminUsers(users, filters),
    [users, filters]
  );
  const summary = useMemo(
    () => summarizeAdminUsers(filtered, filters),
    [filtered, filters]
  );

  function setFilters(next: AdminUserFilters) {
    const query = adminUserFiltersToSearch(next);
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  async function handleDeleteUser(user: AdminUserRow) {
    if (!user.id) return;
    if (user.id === currentUserId) {
      setError("You cannot delete your own account from here.");
      return;
    }
    const label = userLabel(user);
    const confirmed = window.confirm(
      `Delete ${label}? Their listings and photos will be removed too.`
    );
    if (!confirmed) return;

    setDeletingUserId(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not delete user");
      }
      setUsers((prev) => prev.filter((row) => row.id !== user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete user");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleDeleteListing(
    listingId: string,
    label: string,
    ownerId: string | null
  ) {
    const confirmed = window.confirm(
      `Delete “${label}”? Photos for this listing will be removed too.`
    );
    if (!confirmed) return;

    setDeletingListingId(listingId);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not delete listing");
      }
      setUsers((prev) =>
        prev.flatMap((user) => {
          if (user.id !== ownerId) return [user];
          const listings = user.listings.filter((row) => row.id !== listingId);
          if (user.id == null && listings.length === 0) return [];
          let postedCount = 0;
          let photoCount = 0;
          let lastListingAt: string | null = null;
          for (const listing of listings) {
            if (listing.status === "posted") postedCount += 1;
            photoCount += listing.photoCount;
            if (!lastListingAt || listing.updatedAt > lastListingAt) {
              lastListingAt = listing.updatedAt;
            }
          }
          return [
            {
              ...user,
              listings,
              listingCount: listings.length,
              postedCount,
              photoCount,
              lastListingAt,
            },
          ];
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete listing"
      );
    } finally {
      setDeletingListingId(null);
    }
  }

  const hasActiveFilters =
    filters.q.trim() !== "" ||
    filters.platform !== "all" ||
    filters.job !== "all" ||
    filters.listings !== "all" ||
    filters.pin !== "all" ||
    filters.prefs !== "all";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Admin
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-brand)] text-4xl text-pretty text-[var(--foreground)]">
          Users
        </h1>
        <p className="mt-2 text-base tabular-nums text-[var(--muted)]">
          {formatAdminUserSummary(summary)}
        </p>
      </header>

      <AdminPhotoR2Copy />

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {error}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="admin-users-q"
            className="text-sm font-semibold text-[var(--foreground)]"
          >
            Search
          </label>
          <input
            id="admin-users-q"
            name="q"
            type="search"
            value={filters.q}
            spellCheck={false}
            autoComplete="off"
            placeholder="email or user id…"
            onChange={(event) =>
              setFilters({ ...filters, q: event.target.value })
            }
            className="min-h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            id="admin-users-platform"
            label="Store"
            value={filters.platform}
            onChange={(value) =>
              setFilters({
                ...filters,
                platform: value as AdminUserFilters["platform"],
              })
            }
            options={[
              { value: "all", label: "All stores" },
              { value: "mercari", label: PLATFORM_LABELS.mercari },
              { value: "poshmark", label: PLATFORM_LABELS.poshmark },
            ]}
          />
          <FilterSelect
            id="admin-users-job"
            label="Listing state"
            value={filters.job}
            onChange={(value) =>
              setFilters({
                ...filters,
                job: value as AdminUserFilters["job"],
              })
            }
            options={[
              { value: "all", label: "All states" },
              ...ADMIN_USER_JOB_FILTERS.map((job) => ({
                value: job,
                label: listingJobStepLabel(job),
              })),
            ]}
          />
          <FilterSelect
            id="admin-users-listings"
            label="Listings"
            value={filters.listings}
            onChange={(value) =>
              setFilters({
                ...filters,
                listings: value as AdminUserFilters["listings"],
              })
            }
            options={[
              { value: "all", label: "Any" },
              { value: "with", label: "Has listings" },
              { value: "none", label: "No listings" },
            ]}
          />
          <FilterSelect
            id="admin-users-pin"
            label="PIN"
            value={filters.pin}
            onChange={(value) =>
              setFilters({ ...filters, pin: value as AdminUserFilters["pin"] })
            }
            options={[
              { value: "all", label: "Any" },
              { value: "set", label: "PIN set" },
              { value: "none", label: "No PIN" },
            ]}
          />
          <FilterSelect
            id="admin-users-prefs"
            label="Seller profile"
            value={filters.prefs}
            onChange={(value) =>
              setFilters({
                ...filters,
                prefs: value as AdminUserFilters["prefs"],
              })
            }
            options={[
              { value: "all", label: "Any" },
              { value: "complete", label: "Prefs saved" },
              { value: "incomplete", label: "Prefs incomplete" },
            ]}
          />
        </div>
      </form>

      {filtered.length === 0 ? (
        <p className="text-base text-[var(--muted)]">
          {users.length === 0
            ? "No users yet."
            : hasActiveFilters
              ? "No users match these filters."
              : "No users yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((user) => {
            const label = userLabel(user);
            const visibleListings = matchingListings(user, filters);
            const canDeleteUser = Boolean(user.id) && user.id !== currentUserId;
            return (
              <li
                key={user.id ?? "unowned"}
                className="rounded-2xl border border-[var(--border)] bg-white"
                style={{ contentVisibility: "auto" }}
              >
                <details>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block break-words text-lg font-semibold text-[var(--foreground)]">
                        {label}
                      </span>
                      <span className="mt-1 block text-base text-[var(--muted)]">
                        {userMeta(user)}
                      </span>
                      {user.id ? (
                        <span
                          className="mt-1 block font-mono text-xs text-[var(--muted)]"
                          translate="no"
                        >
                          {user.id}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-[var(--accent)]">
                      {visibleListings.length}{" "}
                      {visibleListings.length === 1 ? "listing" : "listings"}
                    </span>
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3">
                    {visibleListings.length === 0 ? (
                      <p className="text-base text-[var(--muted)]">
                        No listings.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {visibleListings.map((listing) => {
                          const listingLabel =
                            listing.title?.trim() ||
                            `${PLATFORM_LABELS[listing.platform]} draft`;
                          return (
                            <li
                              key={listing.id}
                              className="flex flex-col gap-2 rounded-xl border border-[var(--border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="break-words font-semibold text-[var(--foreground)]">
                                  {listingLabel}
                                </p>
                                <p className="text-sm text-[var(--muted)]">
                                  {PLATFORM_LABELS[listing.platform]} ·{" "}
                                  {listingJobLabel(listing)} ·{" "}
                                  {listing.photoCount}{" "}
                                  {listing.photoCount === 1
                                    ? "photo"
                                    : "photos"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <Link
                                  href={`/app/listings/${listing.id}`}
                                  className="text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                                >
                                  Open listing
                                </Link>
                                <Link
                                  href={`/app/admin/bg-lab?listingId=${encodeURIComponent(listing.id)}`}
                                  className="text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                                >
                                  Open AI Photo Lab
                                </Link>
                                <button
                                  type="button"
                                  disabled={deletingListingId === listing.id}
                                  onClick={() =>
                                    void handleDeleteListing(
                                      listing.id,
                                      listingLabel,
                                      user.id
                                    )
                                  }
                                  className="text-sm font-semibold text-[var(--danger)] hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]"
                                  aria-label={`Delete ${listingLabel}`}
                                >
                                  {deletingListingId === listing.id
                                    ? "…"
                                    : "Delete listing"}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {canDeleteUser ? (
                      <button
                        type="button"
                        disabled={deletingUserId === user.id}
                        onClick={() => void handleDeleteUser(user)}
                        className="self-start text-sm font-semibold text-[var(--danger)] hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]"
                        aria-label={`Delete ${label}`}
                      >
                        {deletingUserId === user.id
                          ? "…"
                          : `Delete ${label}`}
                      </button>
                    ) : null}
                    {user.id === currentUserId ? (
                      <p className="text-sm text-[var(--muted)]">
                        This is your account.
                      </p>
                    ) : null}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-[var(--foreground)]"
      >
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
