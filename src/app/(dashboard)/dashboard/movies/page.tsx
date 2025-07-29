import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import MoviesPageClient from "@/components/MoviesPageClient";

export default async function MoviesPage() {
  const session = await auth.api.getSession({
    headers: headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <MoviesPageClient session={{ user: session.user }} />;
}
