// ============================================================
// UXLLY — LightCard
// Plain Tailwind card for the light theme. Use this instead of the
// shared Card (which relies on uxlly-card classes).
// ============================================================

import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface LightCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

const paddings = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

export default function LightCard({
  interactive = false,
  padding = "md",
  children,
  className,
  ...props
}: LightCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-sm",
        interactive &&
          "cursor-pointer transition-all hover:border-blue-200 hover:shadow-md",
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}