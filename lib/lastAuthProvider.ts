"use client";

import { useSyncExternalStore } from "react";

type AuthProvider = "github";

const LAST_AUTH_PROVIDER_COOKIE = "collabdocs_last_auth_provider";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): AuthProvider | null {
  if (typeof document === "undefined") return null;
  const prefix = `${LAST_AUTH_PROVIDER_COOKIE}=`;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(prefix));
  if (!match) return null;
  return decodeURIComponent(match.slice(prefix.length)) === "github"
    ? "github"
    : null;
}

function getServerSnapshot(): AuthProvider | null {
  return null;
}

export function rememberAuthProvider(provider: AuthProvider) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LAST_AUTH_PROVIDER_COOKIE}=${provider}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  for (const listener of listeners) {
    listener();
  }
}

export function useLastAuthProvider(): AuthProvider | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
