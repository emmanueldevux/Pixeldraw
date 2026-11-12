// ============================================================
// UXLLY — Root Page (redirect)
// makesocial.io opens the free chat studio.
// ============================================================

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/chat");
}
