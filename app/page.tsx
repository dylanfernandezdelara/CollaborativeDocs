"use client";

import { AuthNav } from "@/components/AuthControls";
import { SwipeDeleteRow } from "@/components/SwipeDeleteRow";
import { TextAction } from "@/components/TextAction";
import { TypingLine, type TypingLineProps } from "@/components/TypingIndicator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { localOwnerId, useOwnerKey } from "@/lib/ownerKey";
import {
  LIVE_AGENT_MS,
  TYPIST_WINDOW_MS,
} from "@/lib/presenceWindows";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Relative date for the index column: today / yesterday / Nd / Nw / Aug 1. */
function formatRelativeDate(timestamp: number, now: number): string {
  const dayDiff = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(timestamp)) / DAY_MS,
  );

  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "yesterday";
  if (dayDiff <= 6) return `${dayDiff}d`;

  const weeks = Math.floor(dayDiff / 7);
  if (weeks >= 1 && weeks <= 4) return `${weeks}w`;

  const date = new Date(timestamp);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  if (date.getFullYear() !== new Date(now).getFullYear()) {
    return `${month} ${day}, ${date.getFullYear()}`;
  }
  return `${month} ${day}`;
}

/**
 * Index activity from denormalized last-edit + agent timestamps.
 * Human presence rooms are intentionally not subscribed here (privacy + churn).
 */
function indexActivity(
  doc: {
    lastEditedAt?: number;
    lastEditorName?: string;
    lastEditorIsAgent?: boolean;
    agentHeartbeats: Array<{ name: string; lastSeenAt: number }>;
  },
  now: number,
): TypingLineProps | null {
  const liveAgents = doc.agentHeartbeats.filter(
    (agent) => now - agent.lastSeenAt < LIVE_AGENT_MS,
  );
  const typistRecent =
    doc.lastEditedAt !== undefined &&
    now - doc.lastEditedAt < TYPIST_WINDOW_MS &&
    !!doc.lastEditorName;

  if (typistRecent && doc.lastEditorName) {
    // Prefer inclusive agent counts over name-equality dedup (collisions under-count).
    const othersCount = doc.lastEditorIsAgent
      ? Math.max(0, liveAgents.length - 1)
      : liveAgents.length;
    return {
      kind: "typing",
      name: doc.lastEditorName,
      isAgent: !!doc.lastEditorIsAgent,
      othersCount,
    };
  }

  if (liveAgents.length > 0) {
    return { kind: "present", count: liveAgents.length };
  }

  return null;
}

function ownerLabel(isYours: boolean, ownerName: string | null): string {
  if (isYours) return "you";
  return ownerName ?? "guest";
}

export default function HomePage() {
  const router = useRouter();
  const { ownerKey, loaded } = useOwnerKey();
  const localId = ownerKey ? localOwnerId(ownerKey) : undefined;
  const docs = useQuery(
    api.documents.list,
    !loaded || !localId ? "skip" : { localOwnerId: localId },
  );
  const createDoc = useMutation(api.documents.create);
  const removeDoc = useMutation(api.documents.remove);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [openSwipeId, setOpenSwipeId] = useState<Id<"documents"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"documents"> | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function handleCreate() {
    if (!localId) return;
    setCreating(true);
    try {
      const docId = await createDoc({
        title: "Product Roadmap",
        localOwnerId: localId,
      });
      router.push(`/d/${docId}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(docId: Id<"documents">) {
    if (!localId || deletingId) return;
    setDeletingId(docId);
    setDeleteError(null);
    try {
      await removeDoc({ docId, localOwnerId: localId });
      setOpenSwipeId(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Couldn’t delete document",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const listReady = loaded && docs !== undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col px-6 pt-[18vh] pb-8 sm:pt-[20vh] sm:pb-12">
      <nav
        aria-label="Primary navigation"
        className="flex min-h-8 items-center justify-between gap-4"
      >
        <span className="text-[14px] font-medium text-ink">Docs</span>
        <AuthNav />
      </nav>

      <section className="mt-10 sm:mt-12">
        <div className="flex items-baseline border-b-[1.5px] border-ink pb-1.5">
          <h1 className="text-[14px] font-medium text-ink">Documents</h1>
          <span className="flex-1" />
          {listReady ? (
            <span className="text-[11.5px] text-ink-tertiary">
              {docs.length} {docs.length === 1 ? "document" : "documents"}
            </span>
          ) : null}
        </div>

        {!listReady ? (
          <p className="mt-3 text-[13px] text-ink-tertiary">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-tertiary">No documents yet.</p>
        ) : (
          <ul className="mt-1">
            {docs.map((doc) => {
              const activity = indexActivity(doc, now);
              const when = formatRelativeDate(
                doc.lastEditedAt ?? doc.createdAt,
                now,
              );
              return (
                <li key={doc._id} className="border-b border-border">
                  <SwipeDeleteRow
                    enabled={doc.isYours}
                    open={openSwipeId === doc._id}
                    onOpenChange={(open) =>
                      setOpenSwipeId(open ? doc._id : null)
                    }
                    onDelete={() => void handleDelete(doc._id)}
                    deleting={deletingId === doc._id}
                  >
                    <Link
                      href={`/d/${doc._id}`}
                      className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-1.5 transition-opacity duration-200 ease-out hover:opacity-80"
                    >
                      <span className="text-[11px] text-ink-tertiary">
                        {when}
                      </span>
                      <span
                        className={`min-w-0 truncate text-[13px] text-ink ${
                          activity ? "font-medium" : "font-normal"
                        }`}
                      >
                        {doc.title}
                      </span>
                      <span className="pl-3 text-[11.5px] text-ink-tertiary">
                        {ownerLabel(doc.isYours, doc.ownerName)}
                      </span>
                      {activity ? (
                        <div className="col-start-2 col-span-2 min-w-0">
                          <TypingLine {...activity} />
                        </div>
                      ) : null}
                    </Link>
                  </SwipeDeleteRow>
                </li>
              );
            })}
          </ul>
        )}

        {deleteError ? (
          <p className="mt-3 text-[12px] text-destructive" role="alert">
            {deleteError}
          </p>
        ) : null}

        <div className="mt-4">
          <TextAction
            onClick={() => void handleCreate()}
            disabled={creating || !loaded || !localId}
          >
            {creating ? "Creating…" : "New document"}
          </TextAction>
        </div>
      </section>
    </main>
  );
}
