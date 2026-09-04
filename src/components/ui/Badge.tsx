// ============================================================
// UXLLY — Badge Component
// ============================================================

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  variant?: "brand" | "success" | "warning" | "error" | "neutral";
  children: ReactNode;
  className?: string;
}

export default function Badge({
  variant = "neutral",
  children,
  className,
}: BadgeProps) {
  return (
    <span className={cn(`uxlly-badge uxlly-badge-${variant}`, className)}>
      {children}
    </span>
  );
}
