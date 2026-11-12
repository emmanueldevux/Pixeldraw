// ============================================================
// UXLLY — Onboarding (questions shown after sign-up)
//
// Mounted once in the dashboard layout. When a signed-in user has never
// answered (no saved profile), a popup of questions (same container as the sign-up popup) opens over
// whatever page they landed on. Works for every sign-up path (signup page,
// login popup, Google) because it only looks at the saved status.
//
//  - Every question can be skipped; "Skip for now" closes it and a small
//    reminder bar shows on /dashboard until they finish.
//  - Answers are saved after each step, so nothing is lost if they leave.
// ============================================================
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, Check, Globe, Sparkles, X } from "lucide-react";
import {
  EMPTY_ANSWERS,
  GOALS,
  INDUSTRIES,
  PLATFORMS,
  POSTS_PER_DAY,
  STYLES,
  type OnboardingAnswers,
  type OnboardingStatus,
  type Option,
} from "@/lib/onboarding";

interface Ctx {
  status: OnboardingStatus | null;
  answers: OnboardingAnswers;
  open: () => void;
}
const OnboardingContext = createContext<Ctx>({ status: null, answers: EMPTY_ANSWERS, open: () => {} });
export const useOnboarding = () => useContext(OnboardingContext);

async function post(action: "save" | "complete" | "skip", answers: Partial<OnboardingAnswers>) {
  const res = await fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, answers }),
  });
  if (!res.ok) throw new Error("save failed");
  return (await res.json()) as { status: OnboardingStatus; answers: OnboardingAnswers };
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus } = useSession();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setStatus(null);
      setShow(false);
      return;
    }
    let cancelled = false;
    fetch("/api/onboarding", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setStatus(d.status);
        setAnswers(d.answers);
        if (d.status === "none") setShow(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const open = useCallback(() => setShow(true), []);

  return (
    <OnboardingContext.Provider value={{ status, answers, open }}>
      {children}
      {show && (
        <Wizard
          initial={answers}
          onClose={(next) => {
            setShow(false);
            if (next) {
              setStatus(next.status);
              setAnswers(next.answers);
            }
          }}
        />
      )}
    </OnboardingContext.Provider>
  );
}

/** Small bar for /dashboard while onboarding was skipped. */
export function OnboardingReminder() {
  const { status, open } = useOnboarding();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  if (hidden || status !== "skipped" || pathname !== "/dashboard") return null;
  return (
    <div className="mx-6 mt-6 rounded-xl border border-gray-200 bg-[#F7FFF0] px-4 py-3 flex items-center gap-3">
      <Sparkles size={18} className="text-gray-900 shrink-0" />
      <p className="flex-1 text-sm text-gray-800">
        <b>Finish setting up.</b> Answer a few quick questions so we can recommend the right templates for your business.
      </p>
      <button onClick={open} className="h-9 px-4 rounded-lg bg-[#2B2B2B] hover:bg-black text-white text-sm font-semibold">
        Continue
      </button>
      <button onClick={() => setHidden(true)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Hide">
        <X size={16} />
      </button>
    </div>
  );
}

// ==================== The questions ====================

type StepId = "business" | "industry" | "website" | "platforms" | "frequency" | "goals" | "styles";
const STEPS: { id: StepId; title: string; sub: string }[] = [
  { id: "business", title: "Tell us about your business", sub: "We use this to write captions and design posts that sound like you." },
  { id: "industry", title: "What industry are you in?", sub: "Pick the closest one." },
  { id: "website", title: "Do you have a website?", sub: "We can pull your colours, logo and products from it later." },
  { id: "platforms", title: "Where do you want to post?", sub: "Choose all that apply." },
  { id: "frequency", title: "How often do you want to post?", sub: "We'll plan your content around this." },
  { id: "goals", title: "What's your main goal?", sub: "Choose all that apply." },
  { id: "styles", title: "Which styles do you like?", sub: "Pick a few. This shapes the templates we recommend." },
];

const STEP_SHORT: Record<StepId, string> = {
  business: "Your business",
  industry: "Industry",
  website: "Website",
  platforms: "Platforms",
  frequency: "Posting frequency",
  goals: "Goals",
  styles: "Style",
};

const chip = (on: boolean) =>
  `px-4 py-2.5 rounded-xl border text-sm font-medium transition-all text-left inline-flex items-center gap-2 ${
    on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-400 hover:bg-white"
  }`;
const inputCls =
  "w-full h-12 rounded-xl border border-gray-200 bg-white px-4 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-900 transition-colors";

function Chips({ options, value, onChange, multi }: { options: Option[]; value: string | string[] | null; onChange: (v: string) => void; multi?: boolean }) {
  const isOn = (v: string) => (multi ? (value as string[]).includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => (
        <button key={o.value} type="button" className={chip(isOn(o.value))} onClick={() => onChange(o.value)}>
          {multi && isOn(o.value) && <Check size={15} strokeWidth={3} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Wizard({
  initial,
  onClose,
}: {
  initial: OnboardingAnswers;
  onClose: (next?: { status: OnboardingStatus; answers: OnboardingAnswers }) => void;
}) {
  const [a, setA] = useState<OnboardingAnswers>(initial);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // lock page scroll behind the overlay
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const set = <K extends keyof OnboardingAnswers>(k: K, v: OnboardingAnswers[K]) => setA((p) => ({ ...p, [k]: v }));
  const toggle = (k: "platforms" | "goals" | "styles", v: string) =>
    setA((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));
  const single = (k: "industry" | "postsPerDay", v: string) =>
    setA((p) => ({ ...p, [k]: p[k] === v ? null : v }));

  async function next() {
    if (last) {
      setBusy(true);
      try {
        const r = await post("complete", a);
        setDone(true);
        setTimeout(() => onClose(r), 1400);
      } catch {
        onClose();
      } finally {
        setBusy(false);
      }
      return;
    }
    post("save", a).catch(() => {}); // keep progress, don't block the user
    setI(i + 1);
  }

  async function skipAll() {
    setBusy(true);
    try {
      onClose(await post("skip", a));
    } catch {
      onClose();
    }
  }

  const progress = ((done ? STEPS.length : i) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop (same as the sign-up popup) */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />

      {/* Card — sized to its content, styled like the TikTok slideshow popup */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header: brand + progress */}
        <div className="shrink-0 px-7 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <div className="w-7 h-7 rounded-lg bg-[#A3F76B] flex items-center justify-center">
                <Sparkles size={15} className="text-gray-900" />
              </div>
              Set up your workspace
            </div>
            {!done && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Step {i + 1} of {STEPS.length}</span>
                <button onClick={skipAll} disabled={busy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Skip for now" title="Skip for now">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((st, n) => (
              <div key={st.id} title={STEP_SHORT[st.id]} className={`h-1 flex-1 rounded-full transition-colors ${done || n <= i ? "bg-gray-900" : "bg-gray-200"}`} />            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {done ? (
            <div className="flex flex-col items-center justify-center text-center px-8 py-12">
              <span className="w-14 h-14 rounded-full bg-[#A3F76B] flex items-center justify-center">
                <Check size={28} strokeWidth={3} />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-gray-900 tracking-[-0.02em]">You&apos;re all set</h2>
              <p className="mt-2 text-sm text-gray-500">Thanks! We&apos;ll use this to tailor your templates and content.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-7 pt-2 pb-6">
                <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">{step.title}</h2>
                <p className="mt-1.5 text-sm text-gray-500">{step.sub}</p>

                  <div className="mt-6">
                  {step.id === "business" && (
                    <div className="space-y-5">
                      <label className="block">
                        <span className="text-sm font-semibold text-gray-800">Business or brand name</span>
                        <input className={`${inputCls} mt-2`} value={a.businessName ?? ""} onChange={(e) => set("businessName", e.target.value)} placeholder="e.g. Bean & Brew Coffee" autoFocus />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-gray-800">What do you sell or offer?</span>
                        <textarea
                          className={`${inputCls} mt-2 h-24 py-3 resize-none`}
                          value={a.offering ?? ""}
                          onChange={(e) => set("offering", e.target.value)}
                          placeholder="e.g. Specialty coffee, pastries and coffee beans for home brewing"
                        />
                      </label>
                    </div>
                  )}

                  {step.id === "industry" && (
                    <>
                      <Chips options={INDUSTRIES} value={a.industry} onChange={(v) => single("industry", v)} />
                      {a.industry === "other" && (
                        <input className={`${inputCls} mt-4`} value={a.industryOther ?? ""} onChange={(e) => set("industryOther", e.target.value)} placeholder="Tell us your industry" autoFocus />
                      )}
                    </>
                  )}

                  {step.id === "website" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" className={`${chip(a.hasWebsite === true)} justify-center py-3.5`} onClick={() => set("hasWebsite", a.hasWebsite === true ? null : true)}>Yes</button>
                        <button type="button" className={`${chip(a.hasWebsite === false)} justify-center py-3.5`} onClick={() => set("hasWebsite", a.hasWebsite === false ? null : false)}>Not yet</button>
                      </div>
                      {a.hasWebsite && (
                        <label className="mt-5 flex items-center gap-2 rounded-xl border border-gray-200 px-4 h-12 focus-within:border-gray-900">
                          <Globe size={18} className="text-gray-400" />
                          <input
                            className="flex-1 bg-transparent outline-none text-[15px] text-gray-900 placeholder:text-gray-400"
                            value={a.websiteUrl ?? ""}
                            onChange={(e) => set("websiteUrl", e.target.value)}
                            placeholder="yourbusiness.com"
                            inputMode="url"
                            autoFocus
                          />
                        </label>
                      )}
                    </>
                  )}

                  {step.id === "platforms" && <Chips multi options={PLATFORMS} value={a.platforms} onChange={(v) => toggle("platforms", v)} />}

                  {step.id === "frequency" && <Chips options={POSTS_PER_DAY} value={a.postsPerDay} onChange={(v) => single("postsPerDay", v)} />}

                  {step.id === "goals" && <Chips multi options={GOALS} value={a.goals} onChange={(v) => toggle("goals", v)} />}

                  {step.id === "styles" && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {STYLES.map((o) => {
                        const on = a.styles.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggle("styles", o.value)}
                            className={`relative rounded-2xl border p-3 text-left transition-all ${on ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200 hover:border-gray-400"}`}
                          >
                            <div className="h-12 rounded-lg flex overflow-hidden">
                              {o.swatch!.map((c) => (
                                <span key={c} className="flex-1" style={{ background: c }} />
                              ))}
                            </div>
                            <p className="mt-2.5 text-sm font-semibold text-gray-900">{o.label}</p>
                            <p className="text-xs text-gray-500">{o.hint}</p>
                            {on && (
                              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                </div>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-gray-100 px-7 py-4">
              <div className="flex items-center gap-2">
                {i > 0 && (
                  <button onClick={() => setI(i - 1)} disabled={busy} className="h-11 px-3 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 inline-flex items-center gap-1.5">
                    <ArrowLeft size={16} /> Back
                  </button>
                )}
                <div className="flex-1" />
                {!last && (
                  <button onClick={() => setI(i + 1)} disabled={busy} className="h-11 px-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-900">
                    Skip
                  </button>
                )}
                <button
                  onClick={next}
                  disabled={busy}
                  className="h-11 px-6 rounded-xl bg-[#A3F76B] hover:bg-[#8ee05c] text-black text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {last ? (busy ? "Saving…" : "Finish") : "Continue"} {!last && <ArrowRight size={16} />}
                </button>
              </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
