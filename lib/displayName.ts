function guestDisplayName(ownerKey: string | null): string {
  if (!ownerKey) return "Guest";
  return `Guest ${ownerKey.replace(/-/g, "").slice(0, 4)}`;
}

/** Prefer GitHub profile name, else a stable guest label from the cookie. */
export function resolveDisplayName(options: {
  githubName?: string | null;
  ownerKey: string | null;
}): string {
  const github = options.githubName?.trim();
  if (github) return github;
  return guestDisplayName(options.ownerKey);
}
