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

/** Prefer GitHub profile name, else a stable color-word guest label from the cookie. */
export function resolveDisplayName(options: {
  githubName?: string | null;
  ownerKey: string | null;
}): string {
  const github = options.githubName?.trim();
  if (github) return github;
  return guestDisplayName(options.ownerKey);
}
