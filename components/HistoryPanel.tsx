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
        className="border-[rgba(0,0,0,0.10)] bg-[#FAFAFA] data-[side=right]:w-full data-[side=right]:sm:w-[320px] data-[side=right]:sm:max-w-[320px]"
      >
        <SheetHeader>
          <SheetTitle className="text-[14px] font-medium text-[#292929]">
            History
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!edits?.length ? (
            <p className="text-[13px] text-[#9E9E9E]">No agent edits yet.</p>
          ) : (
            <ul className="space-y-4">
              {edits.map((edit) => (
                <li key={edit._id}>
                  <p className="text-[13px] text-[#292929]">
                    {edit.agentName} — {edit.task}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#9E9E9E]">
                    {edit.summary}
                  </p>
                  <p className="mt-1 text-[12px] text-[#9E9E9E]">
                    {formatRelativeTime(edit.createdAt, now)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-[12px] text-[#9E9E9E]">
            Human edits are tracked in the document itself.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
