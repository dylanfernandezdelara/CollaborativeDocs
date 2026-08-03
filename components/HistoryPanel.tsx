"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

type HistoryPanelProps = {
  docId: Id<"documents">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function HistoryPanel({ docId, open, onOpenChange }: HistoryPanelProps) {
  const edits = useQuery(api.edits.listForDoc, { docId });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="border-ink/10 bg-page data-[side=right]:w-full data-[side=right]:sm:w-[320px] data-[side=right]:sm:max-w-[320px]"
      >
        <SheetHeader>
          <SheetTitle className="text-heading font-medium text-ink">
            History
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!edits?.length ? (
            <p className="text-body text-ink-tertiary">No agent edits yet.</p>
          ) : (
            <ul className="space-y-4">
              {edits.map((edit) => (
                <li key={edit._id}>
                  <p className="text-body tracking-[-0.15px] text-ink">
                    {edit.agentName} (agent) — {edit.task}
                  </p>
                  <p className="mt-0.5 text-label text-ink-tertiary">
                    {edit.summary}
                  </p>
                  <p className="mt-1 text-label text-ink-tertiary">
                    {formatRelativeTime(edit.createdAt, now)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-label text-ink-tertiary">
            Human edits are tracked in the document itself.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
