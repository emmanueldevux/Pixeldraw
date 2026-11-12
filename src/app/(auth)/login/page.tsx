// /login now opens the sign-in popup on the main app instead of a separate dark page.
import { redirect } from "next/navigation";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; callbackUrl?: string } }) {
  let dest = "/chat";
  try {
    const u = searchParams.callbackUrl ? new URL(searchParams.callbackUrl, "https://x.local") : null;
    if (u && u.pathname.startsWith("/") && !u.pathname.startsWith("//")) dest = u.pathname;
  } catch {}
  const q = new URLSearchParams({ login: "1" });
  if (searchParams.error) q.set("authError", searchParams.error);
  redirect(`${dest}?${q.toString()}`);
}
