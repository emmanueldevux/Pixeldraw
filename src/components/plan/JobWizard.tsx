// ============================================================
// UXLLY — New automation (recurring job) wizard
//   1. What to make   2. Size   3. When   4. Where to send it
// ============================================================
"use client";

import { useEffect, useState } from "react";
import WizardShell, { type ShellStep } from "@/components/ui/WizardShell";
import SizeCards from "@/components/ui/SizeCards";
import { Chip, LButton, LInput, LSelect, LTextarea, Toggle } from "@/components/ui/light";
import { PLATFORM_PRESETS } from "@/lib/platforms";
import { formatSchedule } from "@/lib/jobs";
import type { PlatformKey } from "@/types";

const STEPS: ShellStep[] = [
  { id: "what", title: "What should it make?", sub: "Describe the post. It runs the same brief every time, with fresh ideas." },
  { id: "size", title: "Pick the size", sub: "The format every run will be made in." },
  { id: "when", title: "When should it run?", sub: "It makes a post at each time, every day, and sends it to you." },
  { id: "send", title: "Where should it go?", sub: "You always get it on the calendar. Add email or Telegram if you want a ping." },
];

const IDEAS = [
  { label: "Daily tip", text: "A short, useful tip my audience can use today, with a clear call to action." },
  { label: "Product spotlight", text: "Spotlight one of my products or services: the benefit, who it's for, and how to get it." },
  { label: "Customer pain point", text: "Speak to a common frustration my customers have and show how we solve it." },
  { label: "Behind the scenes", text: "A relatable behind-the-scenes moment that shows the people and process behind the brand." },
];

const TIME_PRESETS = [
  { label: "Morning", t: "08:00" },
  { label: "Lunch", t: "12:30" },
  { label: "Evening", t: "18:00" },
  { label: "Night", t: "20:30" },
];

interface ProjectLite {
  id: string;
  name: string;
  channels: { id: string; platform: string }[];
}

export default function JobWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState<PlatformKey | null>(null);
  const [times, setTimes] = useState<string[]>(["09:00"]);
  const [custom, setCustom] = useState("");
  const [email, setEmail] = useState(true);
  const [telegram, setTelegram] = useState(false);
  const [chatId, setChatId] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) return;
        const list = (d.data as ProjectLite[]).filter((b) => b.channels?.length);
        setProjects(list);
        if (list[0]) {
          setBrandId(list[0].id);
          setPlatform((list[0].channels[0].platform as PlatformKey) in PLATFORM_PRESETS ? (list[0].channels[0].platform as PlatformKey) : "instagram_portrait");
        }
      })
      .catch(() => {});
  }, []);

  const toggleTime = (t: string) => setTimes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(0, 6)));
  const addCustom = () => {
    if (/^\d{1,2}:\d{2}$/.test(custom)) {
      toggleTime(custom.padStart(5, "0"));
      setCustom("");
    }
  };

  const canContinue = i === 0 ? !!brandId && prompt.trim().length > 4 : i === 1 ? !!platform : i === 2 ? times.length > 0 : !telegram || chatId.trim().length > 0;

  async function create() {
    const project = projects.find((p) => p.id === brandId);
    if (!project || !platform) return;
    setBusy(true);
    setError("");
    try {
      const preset = PLATFORM_PRESETS[platform];
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: project.channels[0].id,
          name: name.trim() || `${project.name}: ${IDEAS.find((x) => x.text === prompt)?.label || "Daily post"}`,
          prompt: prompt.trim(),
          schedule: formatSchedule(times, tz),
          platform,
          size: `${preset.width}x${preset.height}`,
          deliveryEmail: email,
          deliveryTelegram: telegram,
          telegramChatId: telegram ? chatId.trim() : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!d.success) throw new Error(d.error || "Could not create the automation");
      setDone(true);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WizardShell
      heading="New automation"
      steps={STEPS}
      index={i}
      done={done}
      doneTitle="Automation is on"
      doneText="It will make a post at each time you chose and send it to you. Each run is charged at real cost to your credits. Pause or delete it any time from the calendar."
      doneAction={<LButton variant="lime" size="lg" onClick={onClose}>Back to calendar</LButton>}
      busy={busy}
      continueDisabled={!canContinue}
      finishLabel="Turn it on"
      onBack={() => setI(Math.max(0, i - 1))}
      onNext={() => (i === STEPS.length - 1 ? create() : setI(i + 1))}
      onClose={onClose}
      wide={i === 1}
    >
      {i === 0 && (
        <div className="space-y-5">
          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">You need a project first. Create one on the Projects page, then come back.</p>
          ) : (
            <LSelect label="Project" value={brandId} onChange={(e) => { setBrandId(e.target.value); const p = projects.find((x) => x.id === e.target.value); const k = p?.channels[0].platform as PlatformKey; if (k && k in PLATFORM_PRESETS) setPlatform(k); }} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
          )}
          <div>
            <span className="mb-2 block text-sm font-semibold text-gray-800">Start from an idea</span>
            <div className="flex flex-wrap gap-2">{IDEAS.map((x) => <Chip key={x.label} on={prompt === x.text} onClick={() => setPrompt(x.text)}>{x.label}</Chip>)}</div>
          </div>
          <LTextarea label="What should each post be about?" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="e.g. Promote our weekend brunch menu with a friendly, appetising image." />
          <LInput label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning tip" />
        </div>
      )}

      {i === 1 && <SizeCards value={platform} onChange={setPlatform} />}

      {i === 2 && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((p) => <Chip key={p.t} on={times.includes(p.t)} onClick={() => toggleTime(p.t)}>{p.label} · {p.t}</Chip>)}
            {times.filter((t) => !TIME_PRESETS.some((p) => p.t === t)).map((t) => <Chip key={t} on onClick={() => toggleTime(t)}>{t} ×</Chip>)}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1"><LInput label="Add your own time" type="time" value={custom} onChange={(e) => setCustom(e.target.value)} /></div>
            <LButton variant="secondary" size="lg" onClick={addCustom} disabled={!custom}>Add</LButton>
          </div>
          <p className="text-xs text-gray-500">Times use your timezone ({typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "local"}). {times.length} post{times.length === 1 ? "" : "s"} a day.</p>
        </div>
      )}

      {i === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3.5">
            <div><p className="text-sm font-semibold text-gray-900">Email me each post</p><p className="text-xs text-gray-500">Image and caption, sent to your account email.</p></div>
            <Toggle on={email} onChange={setEmail} label="Email" />
          </div>
          <div className="rounded-xl border border-gray-200 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold text-gray-900">Send to Telegram</p><p className="text-xs text-gray-500">Needs your Telegram chat ID.</p></div>
              <Toggle on={telegram} onChange={setTelegram} label="Telegram" />
            </div>
            {telegram && <div className="mt-3"><LInput value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="e.g. -1001234567890" /></div>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </WizardShell>
  );
}
