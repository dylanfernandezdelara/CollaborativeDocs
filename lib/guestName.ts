"use client";

import { useSyncExternalStore } from "react";

export const GUEST_NAME_COOKIE = "collabdocs_guest_name";
/** Keep in sync with `MAX_EDITOR_NAME_LENGTH` in `convex/lib/lastEdit.ts`. */
export const MAX_GUEST_NAME_LENGTH = 64;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(prefix));
  if (!match) return null;
  return decodeURIComponent(match.slice(prefix.length));
}

function writeCookie(name: string, value: string) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

/** Trim and bound a custom guest label; empty clears to the color-word default. */
export function normalizeGuestName(raw: string): string | null {
  const name = raw.trim().slice(0, MAX_GUEST_NAME_LENGTH);
  return name || null;
}

function getSnapshot(): string | null {
  return normalizeGuestName(readCookie(GUEST_NAME_COOKIE) ?? "");
}

function getServerSnapshot(): string | null {
  return null;
}

/** Persist a custom guest display name in a long-lived cookie (clears when empty). */
export function setGuestName(raw: string) {
  const name = normalizeGuestName(raw);
  if (name) {
    writeCookie(GUEST_NAME_COOKIE, name);
  } else {
    clearCookie(GUEST_NAME_COOKIE);
  }
  notify();
}

/** Custom guest display name from cookie, or null to use the color-word default. */
export function useGuestName(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
