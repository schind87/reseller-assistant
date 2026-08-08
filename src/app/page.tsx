import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/api-auth";

export default async function HomePage() {
  try {
    const user = await getAuthUser();
    if (user) redirect("/app");
  } catch {
    // missing env — fall through to unlock
  }
  redirect("/unlock");
}
