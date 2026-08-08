/** Bound for presence, comments, last-edit, and guest rename labels. */
export const MAX_DISPLAY_NAME_LENGTH = 64;

/** Color-word guest names, all 7 characters or fewer. */
const GUEST_COLORS = [
  "Amber",
  "Azure",
  "Cobalt",
  "Copper",
  "Coral",
  "Crimson",
  "Cyan",
  "Emerald",
  "Fuchsia",
  "Gold",
  "Indigo",
  "Ivory",
  "Lilac",
  "Lime",
  "Magenta",
  "Maroon",
  "Olive",
  "Orchid",
  "Rose",
  "Saffron",
  "Scarlet",
  "Sienna",
  "Slate",
  "Teal",
  "Violet",
] as const;

/** Small stable string hash (djb2) so a guest keeps the same name. */
function hashKey(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  return hash >>> 0;
}

/** Stable color-word guest label from the anonymous cookie key (server + client). */
export function guestDisplayName(ownerKey: string | null): string {
  if (!ownerKey) return "Guest";
  const color = GUEST_COLORS[hashKey(ownerKey) % GUEST_COLORS.length];
  return color ? `Guest ${color}` : "Guest";
}

/** First whitespace-separated token of a full name, or null if empty. */
export function firstName(fullName: string | null | undefined): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  const token = trimmed.split(/\s+/)[0];
  return token || null;
}

/**
 * Prefer GitHub profile name, else a custom guest cookie name, else the
 * stable color-word guest label from the owner cookie.
 */
export function resolveDisplayName(options: {
  githubName?: string | null;
  customGuestName?: string | null;
  ownerKey: string | null;
}): string {
  const github = options.githubName?.trim();
  if (github) return github;
  const custom = options.customGuestName?.trim();
  if (custom) return custom;
  return guestDisplayName(options.ownerKey);
}
