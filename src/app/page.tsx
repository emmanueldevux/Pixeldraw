// ============================================================
// UXLLY — Root Page (redirect)
// ============================================================

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
