import { Suspense } from "react";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/safe-internal-path";
import { getSessionFromCookies, isUserSession } from "@/lib/session";
import { UnlockForm } from "./unlock-form";

type PageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function UnlockPage({ searchParams }: PageProps) {
  const session = await getSessionFromCookies();
  if (isUserSession(session)) {
    const params = await searchParams;
    redirect(safeInternalPath(params.next));
  }

  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full w-full max-w-md items-center justify-center px-4 py-12 text-lg text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <UnlockForm />
    </Suspense>
  );
}
