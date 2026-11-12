// The Brand Brain works in the background (built from onboarding + project
// info). There's no page for it; offers are edited in Project settings.
import { redirect } from "next/navigation";

export default function BrainPage() {
  redirect("/dashboard");
}
