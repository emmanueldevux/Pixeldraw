// ============================================================
// UXLLY — Admin (/admin)
// Set what every action costs in credits (your markup), plans, free trial, and grant credits.
// Only emails listed in ADMIN_EMAILS (.env) can open this.
// ============================================================
"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell, btnPrimary, btnSecondary, inputCls } from "@/components/billing/Shell";
import TemplatesAdmin from "@/components/admin/TemplatesAdmin";
import CarouselStylesAdmin from "@/components/admin/CarouselStylesAdmin";
import SlideshowStylesAdmin from "@/components/admin/SlideshowStylesAdmin";
import AiPricesAdmin, { type AiPriceSettings } from "@/components/admin/AiPricesAdmin";
import { formatCredits, toMilli, fromMilli, usd } from "@/lib/billing/units";
import { GOALS, INDUSTRIES, PLATFORMS, POSTS_PER_DAY, STYLES, labelOf, type OnboardingAnswers } from "@/lib/onboarding";

interface Rule { key: string; label: string; provider: string; creditsMilli: number; costMicroUsd: number; active: boolean }
interface Plan { key: string; name: string; priceCents: number; creditsMilli: number; sortOrder: number; active: boolean }
interface Settings {
  creditValueCents: number; topupMinCents: number; topupMaxCents: number; topupPresetsCents: number[]; creditExpiryDays: number;
  freeEnabled: boolean; freeDay1: number; freeLaterDay: number; freeTotal: number; autoReloadMinCents: number; autoReloadMaxCents: number;
}
type AllSettings = Settings & AiPriceSettings;
interface Recent { id: string; email: string; kind: string; deltaMilli: number; note: string | null; createdAt: string }
interface Data { settings: AllSettings; rules: Rule[]; plans: Plan[]; recent: Recent[] }
interface FoundUser {
  user: { id: string; email: string; name: string | null };
  balanceMilli: number;
  free: { available: boolean; usedTotal: number; cap: number };
  plan: string | null;
  freeBonus: number;
  profile: (OnboardingAnswers & { completedAt: string | null; skippedAt: string | null }) | null;
}

type Tab = "pricing" | "plans" | "settings" | "users" | "activity" | "templates" | "carousels" | "slideshows";

async function post(body: unknown) {
  const res = await fetch("/api/admin/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block mb-3">
    <span className="block text-sm font-semibold text-gray-900 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
  </label>
);

export default function AdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>("pricing");
  const [msg, setMsg] = useState<string | null>(null);
  const [ruleEdit, setRuleEdit] = useState<(Rule & { isNew?: boolean }) | null>(null);
  const [planEdit, setPlanEdit] = useState<(Plan & { isNew?: boolean }) | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/billing", { cache: "no-store" });
    if (res.status === 403 || res.status === 401) return setDenied(true);
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  if (denied) {
    return <div className="h-full flex items-center justify-center bg-[#F9F9FB] text-gray-600 text-sm">This page is for admins only. Add your email to ADMIN_EMAILS in .env.</div>;
  }
  if (!data) {
    return <div className="h-full flex items-center justify-center bg-[#F9F9FB]"><div className="w-7 h-7 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" /></div>;
  }

  const cv = data.settings.creditValueCents;
  const tabs: { id: Tab; label: string }[] = [
    { id: "pricing", label: "AI prices" }, { id: "plans", label: "Plans" }, { id: "settings", label: "Settings" },
    { id: "users", label: "Users" }, { id: "activity", label: "Activity" }, { id: "templates", label: "Templates" }, { id: "carousels", label: "Carousels" }, { id: "slideshows", label: "Slideshows" },
  ];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg(ok); await load(); } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="min-h-full bg-[#F9F9FB]">
      <div className={`${tab === "templates" || tab === "carousels" || tab === "slideshows" ? "max-w-none" : "max-w-5xl"} mx-auto px-5 sm:px-8 py-8`}>
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">1 credit sells for {usd(cv)} (change under Settings). Users pay real AI cost × your markup (AI prices).</p>
        <div className="mt-4 flex gap-5 border-b border-gray-200 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{t.label}</button>
          ))}
        </div>
        {msg && <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800">{msg}</div>}

        {tab === "pricing" && (
          <AiPricesAdmin key={JSON.stringify(data.settings)} settings={data.settings} onSave={(patch) => run(() => post({ action: "saveSettings", settings: patch }), "AI prices saved.")} />
        )}

        {tab === "plans" && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Monthly subscription plans. Pay-as-you-go top-ups are controlled under Settings.</p>
              <button className={btnPrimary} onClick={() => setPlanEdit({ key: "", name: "", priceCents: 2000, creditsMilli: 200_000, sortOrder: data.plans.length + 1, active: true, isNew: true })}>Add plan</button>
            </div>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 font-medium">Plan</th><th className="px-4 py-2.5 font-medium text-right">Price / month</th>
                  <th className="px-4 py-2.5 font-medium text-right">Credits</th><th className="px-4 py-2.5 font-medium text-right">$ per credit</th><th />
                </tr></thead>
                <tbody>
                  {data.plans.map((p) => (
                    <tr key={p.key} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2.5"><span className="font-medium text-gray-900">{p.name}</span><span className="block text-xs text-gray-400">{p.key}{!p.active ? " · hidden" : ""}</span></td>
                      <td className="px-4 py-2.5 text-right">{usd(p.priceCents)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatCredits(p.creditsMilli)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">${(p.priceCents / 100 / (p.creditsMilli / 1000)).toFixed(3)}</td>
                      <td className="px-4 py-2.5 text-right"><button className="text-sm font-semibold hover:underline" onClick={() => setPlanEdit({ ...p })}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">Changing a price affects NEW subscribers only; existing subscribers keep the price they signed up at.</p>
          </div>
        )}

        {tab === "settings" && <SettingsForm settings={data.settings} onSave={(s) => run(() => post({ action: "saveSettings", settings: s }), "Settings saved.")} />}
        {tab === "users" && <UsersPanel setMsg={setMsg} />}
        {tab === "templates" && <TemplatesAdmin setMsg={setMsg} />}
        {tab === "carousels" && <CarouselStylesAdmin setMsg={setMsg} />}
        {tab === "slideshows" && <SlideshowStylesAdmin setMsg={setMsg} />}

        {tab === "activity" && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">User</th><th className="px-4 py-2.5 font-medium">What</th><th className="px-4 py-2.5 font-medium text-right">Credits</th></tr></thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{new Date(r.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td className="px-4 py-2 text-gray-900">{r.email}</td>
                    <td className="px-4 py-2 text-gray-600">{r.kind}{r.note ? ` — ${r.note}` : ""}</td>
                    <td className={`px-4 py-2 text-right font-medium ${r.deltaMilli > 0 ? "text-emerald-600" : ""}`}>{r.deltaMilli === 0 ? "—" : (r.deltaMilli > 0 ? "+" : "") + formatCredits(r.deltaMilli)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ruleEdit && (
        <RuleModal rule={ruleEdit} creditValueCents={cv} onClose={() => setRuleEdit(null)}
          onSave={(r) => run(async () => { await post({ action: "saveRule", rule: r }); setRuleEdit(null); }, "Rule saved.")}
          onDelete={ruleEdit.isNew ? undefined : () => confirm("Delete this rule? Actions using it become free.") && run(async () => { await post({ action: "deleteRule", key: ruleEdit.key }); setRuleEdit(null); }, "Rule deleted.")} />
      )}
      {planEdit && (
        <PlanModal plan={planEdit} onClose={() => setPlanEdit(null)}
          onSave={(p) => run(async () => { await post({ action: "savePlan", plan: p }); setPlanEdit(null); }, "Plan saved.")} />
      )}
    </div>
  );
}

function RuleModal({ rule, creditValueCents, onClose, onSave, onDelete }: { rule: Rule & { isNew?: boolean }; creditValueCents: number; onClose: () => void; onSave: (r: Rule) => void; onDelete?: () => void }) {
  const [r, setR] = useState({ ...rule, credits: String(fromMilli(rule.creditsMilli)), cost: String(rule.costMicroUsd / 1e6) });
  const price = ((Number(r.credits) || 0) * creditValueCents) / 100;
  return (
    <Shell title={rule.isNew ? "Add pricing rule" : "Edit pricing rule"} onClose={onClose}
      footer={<>{onDelete && <button className={btnSecondary} onClick={onDelete}>Delete</button>}<button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={() => onSave({ key: r.key, label: r.label, provider: r.provider, active: r.active, creditsMilli: toMilli(Number(r.credits) || 0), costMicroUsd: Math.round((Number(r.cost) || 0) * 1e6) })}>Save</button></>}>
      <Field label="Key" hint="Used by the code, e.g. image.openai, chat.text, vision.analysis. Don't rename existing keys.">
        <input className={inputCls} value={r.key} disabled={!rule.isNew} onChange={(e) => setR({ ...r, key: e.target.value })} />
      </Field>
      <Field label="Label (shown to customers)"><input className={inputCls} value={r.label} onChange={(e) => setR({ ...r, label: e.target.value })} /></Field>
      <Field label="Provider"><input className={inputCls} value={r.provider} onChange={(e) => setR({ ...r, provider: e.target.value })} /></Field>
      <Field label="Credits charged per use" hint={`= $${price.toFixed(3)} charged to the customer`}>
        <input className={inputCls} inputMode="decimal" value={r.credits} onChange={(e) => setR({ ...r, credits: e.target.value.replace(/[^0-9.]/g, "") })} />
      </Field>
      <Field label="Your estimated cost per use (USD)" hint="What OpenAI/Together bill you for one use. Only used to show margin.">
        <input className={inputCls} inputMode="decimal" value={r.cost} onChange={(e) => setR({ ...r, cost: e.target.value.replace(/[^0-9.]/g, "") })} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={r.active} onChange={(e) => setR({ ...r, active: e.target.checked })} /> Charge for this action (off = free)</label>
    </Shell>
  );
}

function PlanModal({ plan, onClose, onSave }: { plan: Plan & { isNew?: boolean }; onClose: () => void; onSave: (p: Plan) => void }) {
  const [p, setP] = useState({ ...plan, price: String(plan.priceCents / 100), credits: String(fromMilli(plan.creditsMilli)) });
  return (
    <Shell title={plan.isNew ? "Add plan" : "Edit plan"} onClose={onClose}
      footer={<><button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={() => onSave({ key: p.key, name: p.name, sortOrder: Number(p.sortOrder) || 0, active: p.active, priceCents: Math.round((Number(p.price) || 0) * 100), creditsMilli: toMilli(Number(p.credits) || 0) })}>Save</button></>}>
      <Field label="Key" hint="Short id, e.g. starter or pro."><input className={inputCls} value={p.key} disabled={!plan.isNew} onChange={(e) => setP({ ...p, key: e.target.value })} /></Field>
      <Field label="Name"><input className={inputCls} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
      <Field label="Price per month (USD)"><input className={inputCls} inputMode="decimal" value={p.price} onChange={(e) => setP({ ...p, price: e.target.value.replace(/[^0-9.]/g, "") })} /></Field>
      <Field label="Credits per month"><input className={inputCls} inputMode="decimal" value={p.credits} onChange={(e) => setP({ ...p, credits: e.target.value.replace(/[^0-9.]/g, "") })} /></Field>
      <Field label="Sort order"><input className={inputCls} inputMode="numeric" value={p.sortOrder} onChange={(e) => setP({ ...p, sortOrder: Number(e.target.value.replace(/[^0-9]/g, "")) })} /></Field>
      <label className="flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Visible to customers</label>
    </Shell>
  );
}

function SettingsForm({ settings, onSave }: { settings: Settings; onSave: (s: Partial<Settings>) => void }) {
  const [f, setF] = useState({
    creditValue: String(settings.creditValueCents / 100), min: String(settings.topupMinCents / 100), max: String(settings.topupMaxCents / 100),
    presets: settings.topupPresetsCents.map((c) => c / 100).join(", "), expiry: String(settings.creditExpiryDays),
    freeEnabled: settings.freeEnabled, day1: String(settings.freeDay1), later: String(settings.freeLaterDay), total: String(settings.freeTotal),
    arMin: String(settings.autoReloadMinCents / 100), arMax: String(settings.autoReloadMaxCents / 100),
  });
  const num = (s: string) => Number(s) || 0;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mt-6 grid md:grid-cols-2 gap-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Credits & top-ups</h3>
        <Field label="What one credit sells for (USD)" hint="Changing this changes how many credits a top-up gives. Existing balances are not changed."><input className={inputCls} value={f.creditValue} onChange={set("creditValue")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Top-up minimum ($)"><input className={inputCls} value={f.min} onChange={set("min")} /></Field>
          <Field label="Top-up maximum ($)"><input className={inputCls} value={f.max} onChange={set("max")} /></Field>
        </div>
        <Field label="Quick amounts ($, comma separated)"><input className={inputCls} value={f.presets} onChange={set("presets")} /></Field>
        <Field label="Credits expire after (days)"><input className={inputCls} value={f.expiry} onChange={set("expiry")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Auto-reload min ($)"><input className={inputCls} value={f.arMin} onChange={set("arMin")} /></Field>
          <Field label="Auto-reload max ($)"><input className={inputCls} value={f.arMax} onChange={set("arMax")} /></Field>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Free trial (images)</h3>
        <p className="text-xs text-gray-500 mb-3">Default: 2 on the first day, 1 on a later day, then locked. To reopen it for one person use Users → Unlock free images.</p>
        <label className="flex items-center gap-2 text-sm text-gray-800 mb-3"><input type="checkbox" checked={f.freeEnabled} onChange={(e) => setF({ ...f, freeEnabled: e.target.checked })} /> Free trial is on for everyone</label>
        <Field label="Free images on the first day"><input className={inputCls} value={f.day1} onChange={set("day1")} /></Field>
        <Field label="Free images per later day"><input className={inputCls} value={f.later} onChange={set("later")} /></Field>
        <Field label="Total free images per user (lifetime)"><input className={inputCls} value={f.total} onChange={set("total")} /></Field>
      </div>
      <div className="md:col-span-2">
        <button className={btnPrimary} onClick={() => onSave({
          creditValueCents: Math.round(num(f.creditValue) * 100), topupMinCents: Math.round(num(f.min) * 100), topupMaxCents: Math.round(num(f.max) * 100),
          topupPresetsCents: f.presets.split(",").map((x) => Math.round(num(x.trim()) * 100)).filter((x) => x > 0), creditExpiryDays: num(f.expiry),
          freeEnabled: f.freeEnabled, freeDay1: num(f.day1), freeLaterDay: num(f.later), freeTotal: num(f.total),
          autoReloadMinCents: Math.round(num(f.arMin) * 100), autoReloadMaxCents: Math.round(num(f.arMax) * 100),
        })}>Save settings</button>
      </div>
    </div>
  );
}

function UsersPanel({ setMsg }: { setMsg: (m: string) => void }) {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundUser | null>(null);
  const [credits, setCredits] = useState("10");
  const [note, setNote] = useState("");
  const [extra, setExtra] = useState("3");

  async function find(e?: string) {
    try { setFound(await post({ action: "findUser", email: e ?? email })); setMsg(""); } catch (err) { setFound(null); setMsg((err as Error).message); }
  }
  async function act(body: Record<string, unknown>, ok: string) {
    try { await post({ ...body, email: found!.user.email }); setMsg(ok); await find(found!.user.email); } catch (err) { setMsg((err as Error).message); }
  }
  return (
    <div className="mt-6 max-w-2xl">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="user@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} />
        <button className={btnPrimary} onClick={() => find()}>Find</button>
      </div>
      {found && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
          <p className="font-semibold text-gray-900">{found.user.name || found.user.email}</p>
          <p className="text-sm text-gray-500">{found.user.email}{found.plan ? ` · ${found.plan} plan` : ""}</p>
          <p className="mt-3 text-sm text-gray-800">Balance: <b>{formatCredits(Math.max(0, found.balanceMilli))} credits</b> · Free trial: <b>{found.free.usedTotal}/{found.free.cap}</b> used {found.free.available ? "(open)" : "(locked)"}</p>

          <div className="mt-4 grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2">
            <input className={inputCls} inputMode="decimal" value={credits} onChange={(e) => setCredits(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="credits" />
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)" />
            <button className={btnPrimary} onClick={() => act({ action: "grantCredits", credits: Number(credits), note }, "Credits granted.")}>Grant</button>
            <button className={btnSecondary} onClick={() => act({ action: "removeCredits", credits: Number(credits), note }, "Credits removed.")}>Remove</button>
          </div>
          <div className="mt-3 grid sm:grid-cols-[1fr_auto] gap-2">
            <input className={inputCls} inputMode="numeric" value={extra} onChange={(e) => setExtra(e.target.value.replace(/[^0-9]/g, ""))} placeholder="extra free images" />
            <button className={btnSecondary} onClick={() => act({ action: "unlockFree", extra: Number(extra) }, "Free images added.")}>Unlock free images</button>
          </div>
          <ProfileAnswers p={found.profile} />
        </div>
      )}
    </div>
  );
}

// ==================== Onboarding answers (read-only) ====================
function ProfileAnswers({ p }: { p: FoundUser["profile"] }) {
  const many = (list: typeof GOALS, vs: string[]) => vs.map((v) => labelOf(list, v)).join(", ");
  const rows: [string, string][] = p
    ? [
        ["Business", p.businessName || ""],
        ["Sells / offers", p.offering || ""],
        ["Industry", p.industry === "other" ? `Other: ${p.industryOther || ""}` : labelOf(INDUSTRIES, p.industry)],
        ["Website", p.hasWebsite === false ? "No website" : p.websiteUrl || (p.hasWebsite ? "Yes" : "")],
        ["Platforms", many(PLATFORMS, p.platforms)],
        ["Posting", labelOf(POSTS_PER_DAY, p.postsPerDay)],
        ["Goals", many(GOALS, p.goals)],
        ["Styles", many(STYLES, p.styles)],
      ]
    : [];
  const status = !p ? "Not answered yet" : p.completedAt ? "Completed" : p.skippedAt ? "Skipped for now" : "In progress";
  return (
    <div className="mt-5 border-t border-gray-100 pt-4">
      <p className="text-sm font-semibold text-gray-900">
        Onboarding <span className="ml-1 text-xs font-medium text-gray-500">{status}</span>
      </p>
      {rows.length > 0 && (
        <dl className="mt-2 grid sm:grid-cols-[140px_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500">{k}</dt>
              <dd className="text-gray-900">{v || <span className="text-gray-400">—</span>}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
