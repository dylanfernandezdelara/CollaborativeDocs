"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "collabdocs-name";
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function notifySubscribers() {
  listeners.forEach((listener) => listener());
}

function getNameSnapshot() {
  return localStorage.getItem(STORAGE_KEY);
}

function getNameServerSnapshot() {
  return null;
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

  return { name, loaded, saveName };
}

export function NamePrompt({ onDone }: { onDone: (name: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(0,0,0,0.10)] bg-white p-6">
        <h2 className="text-[14px] font-medium text-[#292929]">
          What should we call you?
        </h2>
        <p className="mt-1 text-[13px] text-[#5D5D5D]">
          Your name appears on comments and presence.
        </p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (trimmed) onDone(trimmed);
          }}
        >
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your name"
            className="h-9 text-[14px]"
          />
          <Button
            type="submit"
            disabled={!value.trim()}
            className="rounded-full text-[13px]"
          >
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
