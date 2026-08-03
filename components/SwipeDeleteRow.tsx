"use client";

import type { PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";

const ACTION_WIDTH = 72;
/** Distance past which the row snaps open on release. */
const OPEN_THRESHOLD = 36;
/** Ignore tiny moves so a tap still opens the document. */
const DRAG_SLOP = 6;

type SwipeDeleteRowProps = {
  /** Only owned rows expose the delete action. */
  enabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void | Promise<void>;
  deleting?: boolean;
  children: ReactNode;
};

/**
 * iOS Mail-style swipe: drag left to reveal Delete, tap Delete to commit.
 * Pointer-based so trackpad / mouse / touch all work. Non-enabled rows
 * render children unchanged (shared docs stay open-as-usual).
 */
export function SwipeDeleteRow({
  enabled,
  open,
  onOpenChange,
  onDelete,
  deleting = false,
  children,
}: SwipeDeleteRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Refs gate the gesture so synchronous pointermove after pointerdown still
  // counts — React state from pointerdown has not re-rendered yet.
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const latestOffset = useRef(0);
  const dragged = useRef(false);
  const pointerId = useRef<number | null>(null);

  if (!enabled) {
    return <>{children}</>;
  }

  const reveal = dragging ? offset : open ? -ACTION_WIDTH : 0;

  function clamp(next: number) {
    return Math.min(0, Math.max(-ACTION_WIDTH, next));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (deleting || e.button !== 0) return;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startOffset.current = open ? -ACTION_WIDTH : 0;
    latestOffset.current = startOffset.current;
    dragged.current = false;
    draggingRef.current = true;
    setOffset(startOffset.current);
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || pointerId.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > DRAG_SLOP) {
      dragged.current = true;
    }
    const next = clamp(startOffset.current + dx);
    latestOffset.current = next;
    setOffset(next);
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || pointerId.current !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const shouldOpen = latestOffset.current <= -OPEN_THRESHOLD;
    draggingRef.current = false;
    setDragging(false);
    setOffset(0);
    pointerId.current = null;
    onOpenChange(shouldOpen);
  }

  return (
    <div className="relative overflow-hidden">
      {(open || dragging) && (
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            if (deleting) return;
            void onDelete();
          }}
          style={{ width: ACTION_WIDTH }}
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-label font-medium tracking-[-0.15px] text-background transition-opacity duration-200 ease-out disabled:opacity-60"
        >
          {deleting ? "…" : "Delete"}
        </button>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          // A drag or an open row should not navigate into the document.
          if (dragged.current || open) {
            e.preventDefault();
            e.stopPropagation();
            if (open && !dragged.current) {
              onOpenChange(false);
            }
            dragged.current = false;
          }
        }}
        style={{
          transform: `translateX(${reveal}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
          touchAction: "pan-y",
        }}
        className="relative bg-page select-none"
      >
        {children}
      </div>
    </div>
  );
}
