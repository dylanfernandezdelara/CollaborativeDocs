"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  MAX_MEMO_TITLE_LENGTH,
  normalizeMemoTitle,
} from "@/lib/memoTitle";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

const TITLE_SAVE_MS = 400;

type MemoTitleProps = {
  docId: Id<"documents">;
  title: string;
  /** Focus the field on mount (new-memo create flow). */
  autoFocus?: boolean;
  onEnter?: () => void;
};

export function MemoTitle({
  docId,
  title,
  autoFocus = false,
  onEnter,
}: MemoTitleProps) {
  const updateTitle = useMutation(api.documents.updateTitle);
  const [draft, setDraft] = useState(title);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestDraftRef = useRef(title);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setDraft(title);
    latestDraftRef.current = title;
  }, [title]);

  useEffect(() => {
    if (!autoFocus) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [autoFocus]);

  const flushSave = useEffectEvent(async (value: string) => {
    const normalized = normalizeMemoTitle(value);
    try {
      await updateTitle({ docId, title: normalized });
      if (!mountedRef.current) return;
      if (document.activeElement !== inputRef.current) {
        setDraft(normalized);
        latestDraftRef.current = normalized;
      }
    } catch (error) {
      console.error("Failed to save memo title", error);
      if (!mountedRef.current) return;
      setDraft(title);
      latestDraftRef.current = title;
    }
  });

  function cancelScheduledSave() {
    if (saveTimerRef.current === null) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  }

  function flushNow(value: string = latestDraftRef.current) {
    cancelScheduledSave();
    const normalized = normalizeMemoTitle(value);
    setDraft(normalized);
    latestDraftRef.current = normalized;
    void flushSave(normalized);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current !== null) {
        cancelScheduledSave();
        void flushSave(latestDraftRef.current);
      }
    };
  }, []);

  function scheduleSave(value: string) {
    latestDraftRef.current = value;
    cancelScheduledSave();
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushSave(latestDraftRef.current);
    }, TITLE_SAVE_MS);
  }

  function handleChange(value: string) {
    const next = value.slice(0, MAX_MEMO_TITLE_LENGTH);
    setDraft(next);
    scheduleSave(next);
  }

  function handleFocus() {
    setFocused(true);
    const input = inputRef.current;
    if (!input) return;
    if (normalizeMemoTitle(input.value) === "Untitled" && input.value.trim() !== "") {
      requestAnimationFrame(() => input.select());
    }
  }

  function handleBlur() {
    setFocused(false);
    flushNow();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      flushNow();
      onEnter?.();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelScheduledSave();
      setDraft(title);
      latestDraftRef.current = title;
      inputRef.current?.blur();
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(event) => handleChange(event.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label="Memo title"
      placeholder="Untitled"
      maxLength={MAX_MEMO_TITLE_LENGTH}
      className={cn(
        "mb-6 w-full scroll-mt-16 border-0 border-b bg-transparent p-0 pb-2 text-title font-medium tracking-[-0.15px] text-ink caret-ink outline-none transition-[border-color] duration-200 ease-out placeholder:text-ink-tertiary sm:scroll-mt-20",
        focused
          ? "border-primary"
          : "border-transparent hover:border-border",
      )}
    />
  );
}
