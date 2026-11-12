// ============================================================
// UXLLY — Auth Gate
// Lets anonymous users browse freely. Gated actions (sending a
// chat, creating a project, creating an automation) call
// requireAuth(action): if signed in, the action runs immediately;
// if not, the login popup opens and the action is replayed the
// moment they finish signing in — so they never lose their intent.
// ============================================================

"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import LoginModal from "@/components/auth/LoginModal";

interface AuthGateContextValue {
  /** Returns true if already authenticated (action ran). Otherwise opens the
   *  login popup and replays `action` after a successful sign-in. */
  requireAuth: (action?: () => void) => boolean;
  isAuthenticated: boolean;
  openLogin: () => void;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const requireAuth = useCallback(
    (action?: () => void) => {
      if (status === "authenticated") {
        action?.();
        return true;
      }
      pendingAction.current = action ?? null;
      setOpen(true);
      return false;
    },
    [status]
  );

  const openLogin = useCallback(() => setOpen(true), []);

  // The instant the session flips to authenticated while the popup is open,
  // close it and replay whatever the user was trying to do.
  useEffect(() => {
    if (status === "authenticated" && open) {
      setOpen(false);
      const action = pendingAction.current;
      pendingAction.current = null;
      if (action) action();
    }
  }, [status, open]);

  return (
    <AuthGateContext.Provider
      value={{ requireAuth, isAuthenticated: status === "authenticated", openLogin }}
    >
      {children}
      <LoginModal open={open} onClose={() => setOpen(false)} />
    </AuthGateContext.Provider>
  );
}

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  // Fallback when used outside the provider: don't block the action.
  if (!ctx) {
    return {
      requireAuth: (action?: () => void) => {
        action?.();
        return true;
      },
      isAuthenticated: true,
      openLogin: () => {},
    };
  }
  return ctx;
}
