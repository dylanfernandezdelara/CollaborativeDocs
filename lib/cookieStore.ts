"use client";

import { useSyncExternalStore } from "react";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

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

/** Long-lived client cookie + React subscription, shared by identity modules. */
export function createCookieStore(cookieName: string) {
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

  function getSnapshot(): string | null {
    return readCookie(cookieName);
  }

  function getServerSnapshot(): string | null {
    return null;
  }

  function setValue(value: string | null) {
    if (value) {
      writeCookie(cookieName, value);
    } else {
      clearCookie(cookieName);
    }
    notify();
  }

  function useValue(): string | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  return { useValue, setValue, getSnapshot };
}
