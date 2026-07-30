import type { HighlightEntry } from "@/components/HighlightExtension";

let highlights: HighlightEntry[] = [];

export function setHighlights(entries: HighlightEntry[]) {
  highlights = entries;
}

export function getHighlights() {
  return highlights;
}
