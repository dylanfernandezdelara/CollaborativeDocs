"use client";

import Link from "next/link";
import { pressHaptic } from "@/lib/haptics";
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

// Press feedback: `active:` dims instantly (transition-none while pressed) and
// eases back over 200ms on release, so taps register even without hover.
// `select-none` + no touch callout keep a long-press from starting text
// selection on touch devices, which would swallow the `:active` state.
const baseClassName =
  "inline cursor-pointer touch-manipulation select-none border-0 bg-transparent p-0 text-body font-medium tracking-[-0.15px] underline underline-offset-[3px] transition-[color,text-decoration-color,opacity] duration-200 ease-out active:opacity-55 active:transition-none disabled:pointer-events-none disabled:opacity-50 [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]";

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
        onPointerDown={pressHaptic}
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
      onPointerDown={pressHaptic}
      disabled={disabled}
      className={classes}
      {...aria}
    >
      {children}
    </button>
  );
}
