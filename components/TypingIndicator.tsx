"use client";

import { useEffect, useState } from "react";

const DOTS_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const DOTS_INTERVAL_MS = 80;

export function DotsSpinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((current) => (current + 1) % DOTS_FRAMES.length);
    }, DOTS_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      aria-hidden
      className="inline text-[11px] not-italic text-ink-secondary"
    >
      {DOTS_FRAMES[frame]}
    </span>
  );
}

export type TypingLineProps =
  | {
      kind: "typing";
      name: string;
      isAgent?: boolean;
      othersCount?: number;
    }
  | {
      kind: "present";
      count: number;
    };

export function TypingLine(props: TypingLineProps) {
  const label =
    props.kind === "typing"
      ? `${props.name}${props.isAgent ? " (agent)" : ""} is typing${
          props.othersCount && props.othersCount > 0
            ? ` · ${props.othersCount} other${props.othersCount === 1 ? "" : "s"} in the doc`
            : ""
        }`
      : `${props.count} in the doc`;

  return (
    <span className="inline text-[11px] italic text-ink-secondary">
      <DotsSpinner /> {label}
    </span>
  );
}
