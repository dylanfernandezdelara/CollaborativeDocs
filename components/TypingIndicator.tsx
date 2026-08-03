"use client";

import { DotsSpinner } from "@/components/DotsSpinner";

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
            ? ` · ${props.othersCount} other${props.othersCount === 1 ? "" : "s"} in the memo`
            : ""
        }`
      : `${props.count} in the memo`;

  return (
    <span className="inline text-caption italic text-ink-secondary">
      <DotsSpinner /> {label}
    </span>
  );
}
