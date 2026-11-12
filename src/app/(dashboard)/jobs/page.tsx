// Jobs now live inside the Calendar (Automations). Old links land there.
import { redirect } from "next/navigation";

export default function JobsPage() {
  redirect("/calendar?view=automations");
}
