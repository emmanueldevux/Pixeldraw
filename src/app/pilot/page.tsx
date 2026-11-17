// @pilot-file — the rig shell. Dev/staging only: 404s unless NEXT_PUBLIC_PILOT=1.
import { notFound } from "next/navigation";
import PilotRig from "@/pilot/PilotRig";

export const dynamic = "force-dynamic";

export default function PilotPage() {
  if (process.env.NEXT_PUBLIC_PILOT !== "1") notFound();
  return <PilotRig />;
}
