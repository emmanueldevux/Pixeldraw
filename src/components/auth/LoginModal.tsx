// ============================================================
// UXLLY — Login Popup
// Light-theme, responsive, two-column auth modal. Shown on gated
// actions (see AuthGate). Providers: Google + email/password.
// ============================================================

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "signup" | "signin";

const FEATURES = ["Image posts", "Carousels", "TikTok slideshows", "Brand kit"];

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const callbackUrl =
    typeof window !== "undefined" ? window.location.href : "/dashboard";

  function handleGoogle() {
    signIn("google", { callbackUrl });
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name || email.split("@")[0], email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not create your account.");
          setLoading(false);
          return;
        }
      }
      // Sign in (covers both: fresh signup and returning user). The session
      // flips to authenticated and AuthGate closes this popup + replays intent.
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(mode === "signup" ? "Account made, but sign-in failed. Try signing in." : "Invalid email or password.");
        setLoading(false);
        return;
      }
      // success — leave the spinner on; AuthGate will unmount this modal.
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const primaryCta = mode === "signup" ? "Start creating for free" : "Sign in";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Card */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* LEFT — promo (hidden on small screens) */}
        <div className="hidden md:flex md:w-1/2 flex-col justify-between p-8 bg-gradient-to-br from-[#EEF2FF] via-[#F5F3FF] to-[#FDF2F8]">
          <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-lg">
            U
          </div>
          <div>
            <h3 className="text-[26px] leading-tight font-bold text-gray-900 tracking-[-0.02em]">
              Scroll-stopping social graphics, on brand, in seconds.
            </h3>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              UXLLY turns a prompt into finished posts that match your brand —
              colors, fonts, logo and all.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full bg-white/70 border border-white text-xs font-medium text-gray-700"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT — auth */}
        <div className="w-full md:w-1/2 p-7 sm:p-9 overflow-y-auto">
          <div className="max-w-sm mx-auto">
            <div className="md:hidden w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold mb-4">
              U
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-[-0.02em]">
              {mode === "signup" ? "Create your free account" : "Welcome back"}
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              {mode === "signup"
                ? "Sign up to generate, save and schedule your content."
                : "Sign in to pick up where you left off."}
            </p>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-800 bg-gray-50 text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Email / password */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {mode === "signup" && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Create a password (8+ characters)" : "Password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
              />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#A3F76B] text-black text-sm font-semibold hover:bg-[#8ee05c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Please wait…" : primaryCta}
              </button>
            </form>

            {/* Mode toggle */}
            <p className="mt-5 text-center text-sm text-gray-500">
              {mode === "signup" ? "Already have an account?" : "New to UXLLY?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError("");
                }}
                className="font-semibold text-gray-900 hover:underline"
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>

            <p className="mt-4 text-center text-[11px] text-gray-400">
              By continuing you agree to UXLLY&apos;s Terms and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
