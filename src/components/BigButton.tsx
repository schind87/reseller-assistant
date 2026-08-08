"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type BigButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  fullWidth?: boolean;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border-transparent",
  secondary:
    "bg-white text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--surface-muted)]",
  ghost:
    "bg-transparent text-[var(--accent)] border-transparent hover:bg-[var(--accent-soft)]",
  danger:
    "bg-[var(--danger)] text-white border-transparent hover:opacity-90",
};

export function BigButton({
  children,
  variant = "primary",
  fullWidth = true,
  className = "",
  type = "button",
  disabled,
  ...rest
}: BigButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        "touch-target inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-4",
        "text-lg font-semibold leading-tight transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        fullWidth ? "w-full" : "",
        variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
