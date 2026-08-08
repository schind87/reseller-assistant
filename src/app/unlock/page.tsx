import { Suspense } from "react";
import { UnlockForm } from "./unlock-form";

export default function UnlockPage() {
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
