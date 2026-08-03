"use client";

import { useEffect, useState } from "react";

const DOTS_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const DOTS_INTERVAL_MS = 80;

/**
 * The app's primary motion signal (see DESIGN.md): the `dots` spinner from
 * cli-spinners, rendered as quiet gray text.
 */
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
      className="inline text-caption not-italic text-ink-secondary"
    >
      {DOTS_FRAMES[frame]}
    </span>
  );
}
