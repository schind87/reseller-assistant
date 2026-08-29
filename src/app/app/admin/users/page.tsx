import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminUsersConsole } from "@/components/AdminUsersConsole";
import { getAdminUser } from "@/lib/admin";
import { listAdminUsers } from "@/lib/supabase/admin-users";

export default async function AdminUsersPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/app");
  }

  let users;
  try {
    users = await listAdminUsers();
  } catch (err) {
    console.error("listAdminUsers failed:", err);
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-lg text-red-800">
        Could not load users.
      </main>
    );
  }

  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-4 py-10 text-lg text-[var(--muted)]">
          Loading users…
        </main>
      }
    >
      <AdminUsersConsole initialUsers={users} currentUserId={admin.id} />
    </Suspense>
  );
}
