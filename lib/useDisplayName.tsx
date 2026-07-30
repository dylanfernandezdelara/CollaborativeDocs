"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "collabdocs-name";
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function notifySubscribers() {
  listeners.forEach((listener) => listener());
}

function getStoredName(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function getNameSnapshot(): string | null {
  return getStoredName();
}

function getNameServerSnapshot(): string | null {
  return null;
}

function shortSuffix(seed: string): string {
  return seed.replace(/-/g, "").slice(0, 4);
}

/** Prefer an explicit name, then GitHub profile name, then a stable guest label. */
export function resolveDisplayName(options: {
  storedName: string | null;
  githubName?: string | null;
  ownerKey: string | null;
}): string {
  const stored = options.storedName?.trim();
  if (stored) return stored;

  const github = options.githubName?.trim();
  if (github) return github;

  if (options.ownerKey) {
    return `Guest ${shortSuffix(options.ownerKey)}`;
  }

  return "Guest";
}

export function useDisplayName() {
  const name = useSyncExternalStore(
    subscribe,
    getNameSnapshot,
    getNameServerSnapshot,
  );
  const loaded = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const saveName = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    notifySubscribers();
  }, []);

  const clearName = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    notifySubscribers();
  }, []);

  return { name, loaded, saveName, clearName };
}
