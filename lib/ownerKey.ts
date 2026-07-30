"use client";

import { useCallback, useSyncExternalStore } from "react";

export const OWNER_COOKIE = "collabdocs_owner";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function notifySubscribers() {
  listeners.forEach((listener) => listener());
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
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function createOwnerKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `owner_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function ensureOwnerKey(): string | null {
  if (typeof document === "undefined") return null;
  const existing = readCookie(OWNER_COOKIE);
  if (existing) return existing;
  const created = createOwnerKey();
  writeCookie(OWNER_COOKIE, created);
  return created;
}

function getOwnerKeySnapshot(): string | null {
  return ensureOwnerKey();
}

function getOwnerKeyServerSnapshot(): string | null {
  return null;
}

/** Local anonymous owner id stored in a long-lived cookie. */
export function useOwnerKey() {
  const ownerKey = useSyncExternalStore(
    subscribe,
    getOwnerKeySnapshot,
    getOwnerKeyServerSnapshot,
  );
  const loaded = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const refresh = useCallback(() => {
    notifySubscribers();
  }, []);

  return { ownerKey, loaded, refresh };
}

export function localOwnerId(ownerKey: string): string {
  return `local:${ownerKey}`;
}

export function isLocalOwnerId(ownerId: string): boolean {
  return ownerId.startsWith("local:") && ownerId.length > "local:".length;
}
