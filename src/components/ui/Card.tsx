// ============================================================
// UXLLY — Card Component
// ============================================================

import { cn } from "@/lib/utils";
import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

export default function Card({
  interactive = false,
  padding = "md",
  children,
  className,
  ...props
}: CardProps) {
  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
        "uxlly-card",
        interactive && "uxlly-card-interactive",
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
