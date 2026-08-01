"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AriaAttributes, MouseEventHandler, ReactNode } from "react";

export type TextActionVariant = "primary" | "secondary";

type TextActionProps = AriaAttributes & {
  variant?: TextActionVariant;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

const baseClassName =
  "inline cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium tracking-[-0.15px] underline underline-offset-[3px] transition-colors duration-200 ease-out disabled:pointer-events-none disabled:opacity-50";

const variantClassName = {
  primary:
    "text-ink decoration-primary decoration-[1.5px] hover:text-[color-mix(in_srgb,var(--text-primary)_85%,black)]",
  secondary:
    "text-ink-tertiary decoration-ink-tertiary decoration-[1px] hover:text-ink-secondary hover:decoration-ink-secondary",
} as const;

/** Shared underline-action classes for non-`TextAction` hosts (e.g. PopoverTrigger). */
export function textActionClassName(
  variant: TextActionVariant = "primary",
  className?: string,
): string {
  return cn(baseClassName, variantClassName[variant], className);
}

export function TextAction({
  variant = "primary",
  href,
  onClick,
  disabled,
  className,
  children,
  ...aria
}: TextActionProps) {
  const classes = textActionClassName(variant, className);

  if (href !== undefined) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(classes, disabled && "pointer-events-none opacity-50")}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        {...aria}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
      {...aria}
    >
      {children}
    </button>
  );
}
