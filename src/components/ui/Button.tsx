// ============================================================
// UXLLY — Button Component
// ============================================================

import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 font-medium rounded-button transition-all duration-150 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2";

    const variants = {
      primary: "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700",
      secondary:
        "bg-surface-100 text-ink-900 border border-surface-200 hover:bg-surface-200 active:bg-surface-300",
      ghost: "bg-transparent text-ink-600 hover:bg-surface-100 active:bg-surface-200",
      danger:
        "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:bg-red-200",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-2.5 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          (disabled || loading) && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className="uxlly-spinner" />}
        {!loading && icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
