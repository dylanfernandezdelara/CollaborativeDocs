"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

const TITLE_SAVE_MS = 400;
const MAX_TITLE_LENGTH = 200;

type MemoTitleProps = {
  docId: Id<"documents">;
  title: string;
  /** Focus the field on mount (new-memo create flow). */
  autoFocus?: boolean;
  onEnter?: () => void;
};

function coerceDraft(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function MemoTitle({
  docId,
  title,
  autoFocus = false,
  onEnter,
}: MemoTitleProps) {
  const updateTitle = useMutation(api.documents.updateTitle);
  const [draft, setDraft] = useState(() => coerceDraft(title));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestDraftRef = useRef(coerceDraft(title));

  // Keep draft in sync when remote title changes and we aren't mid-edit.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    const next = coerceDraft(title);
    setDraft(next);
    latestDraftRef.current = next;
  }, [title]);

  useEffect(() => {
    if (!autoFocus) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const flushSave = useEffectEvent(async (value: string) => {
    try {
      await updateTitle({ docId, title: coerceDraft(value) });
    } catch (error) {
      console.error("Failed to save memo title", error);
      const fallback = coerceDraft(title);
      setDraft(fallback);
      latestDraftRef.current = fallback;
    }
  });

  function scheduleSave(value: string) {
    latestDraftRef.current = value;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushSave(latestDraftRef.current);
    }, TITLE_SAVE_MS);
  }

  function handleChange(value: string) {
    const next = coerceDraft(value).slice(0, MAX_TITLE_LENGTH);
    setDraft(next);
    scheduleSave(next);
  }

  function handleBlur() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void flushSave(latestDraftRef.current);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void flushSave(latestDraftRef.current);
      onEnter?.();
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label="Memo title"
      placeholder="Untitled"
      maxLength={MAX_TITLE_LENGTH}
      className="mb-3 w-full border-0 bg-transparent p-0 text-title font-medium tracking-[-0.15px] text-ink outline-none placeholder:text-ink-tertiary"
    />
  );
}
