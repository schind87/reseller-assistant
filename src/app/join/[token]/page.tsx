import { Suspense } from "react";
import { JoinTokenClient } from "./join-token-client";

export default function JoinTokenPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full w-full max-w-md items-center justify-center px-4 py-16 text-lg text-[var(--muted)]">
          Joining…
        </main>
      }
    >
      <JoinTokenClient />
    </Suspense>
  );
}
