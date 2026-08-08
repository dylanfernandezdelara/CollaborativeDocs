"use client";

import { createCookieStore } from "@/lib/cookieStore";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/displayName";

export const GUEST_NAME_COOKIE = "collabdocs_guest_name";
export const MAX_GUEST_NAME_LENGTH = MAX_DISPLAY_NAME_LENGTH;

const store = createCookieStore(GUEST_NAME_COOKIE);

/** Trim and bound a custom guest label; empty clears to the color-word default. */
export function normalizeGuestName(raw: string): string | null {
  const name = raw.trim().slice(0, MAX_GUEST_NAME_LENGTH);
  return name || null;
}

/** Persist a custom guest display name in a long-lived cookie (clears when empty). */
export function setGuestName(raw: string) {
  store.setValue(normalizeGuestName(raw));
}

/** Custom guest display name from cookie, or null to use the color-word default. */
export function useGuestName(): string | null {
  return normalizeGuestName(store.useValue() ?? "");
}
