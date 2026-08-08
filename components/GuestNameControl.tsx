"use client";

import { resolveDisplayName } from "@/lib/displayName";
import {
  MAX_GUEST_NAME_LENGTH,
  setGuestName,
  useGuestName,
} from "@/lib/guestName";
import { useOwnerKey } from "@/lib/ownerKey";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/** Inline rename control for anonymous guests (cookie-backed display name). */
export function GuestNameControl() {
  const { ownerKey, loaded } = useOwnerKey();
  const customName = useGuestName();
  const displayName = resolveDisplayName({
    customGuestName: customName,
    ownerKey,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editing]);

  function startEditing() {
    skipBlurCommitRef.current = false;
    setDraft(displayName);
    setEditing(true);
  }

  function commit() {
    setGuestName(draft);
    setEditing(false);
  }

  function cancel() {
    // Escape unmounts the input and would fire blur → commit; skip that path.
    skipBlurCommitRef.current = true;
    setDraft(displayName);
    setEditing(false);
  }

  function handleBlur() {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    commit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (!loaded) {
    return <span className="h-7 w-20" aria-hidden="true" />;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) =>
          setDraft(event.target.value.slice(0, MAX_GUEST_NAME_LENGTH))
        }
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label="Your guest name"
        maxLength={MAX_GUEST_NAME_LENGTH}
        className="max-w-36 border-0 border-b border-primary bg-transparent p-0 text-label tracking-[-0.15px] text-ink caret-ink outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label="Rename guest account"
      title="Rename"
      className="max-w-32 truncate border-0 bg-transparent p-0 text-left text-label tracking-[-0.15px] text-ink-tertiary transition-colors duration-200 ease-out hover:text-ink-secondary"
    >
      {displayName}
    </button>
  );
}
