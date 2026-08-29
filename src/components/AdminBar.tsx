"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app/admin/bg-lab", label: "AI Photo Lab" },
  { href: "/app/admin/users", label: "Users" },
] as const;

export function AdminBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface-muted)]"
    >
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Admin
        </p>
        {LINKS.map((link) => {
          const current =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? "page" : undefined}
              className={[
                "text-sm font-semibold text-[var(--accent)] hover:underline",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                current ? "underline" : "",
              ].join(" ")}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
