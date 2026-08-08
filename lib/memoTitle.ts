/** Shared memo-title rules for client + Convex. */

export const MAX_MEMO_TITLE_LENGTH = 200;

/** Normalize a memo title for storage/display; empty → `"Untitled"`. */
export function normalizeMemoTitle(raw: string): string {
  // Cap before whitespace collapse so pathological payloads stay cheap.
  const capped = raw.slice(0, MAX_MEMO_TITLE_LENGTH * 4);
  const trimmed = capped.replace(/\s+/g, " ").trim();
  if (!trimmed) return "Untitled";
  return trimmed.slice(0, MAX_MEMO_TITLE_LENGTH);
}

/** Browser tab / index display — empty → `"Untitled"`. */
export function displayMemoTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed || "Untitled";
}
