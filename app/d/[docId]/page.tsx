"use client";

import { AvatarStack } from "@/components/AvatarStack";
import { CommentsPanel } from "@/components/CommentsPanel";
import {
  createHighlightExtension,
  refreshHighlights,
} from "@/components/HighlightExtension";
import { getHighlights, setHighlights } from "@/lib/highlightStore";
import { HistoryPanel } from "@/components/HistoryPanel";
import { ShareDialog } from "@/components/ShareDialog";
import { TextAction, textActionClassName } from "@/components/TextAction";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { editorExtensions } from "@/lib/editorExtensions";
import { resolveDisplayName } from "@/lib/displayName";
import { localOwnerId, useOwnerKey } from "@/lib/ownerKey";
import { LIVE_AGENT_MS, TOUCH_THROTTLE_MS } from "@/lib/presenceWindows";
import { useAcceptCollaboratorInvite } from "@/lib/useAcceptCollaboratorInvite";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import usePresence from "@convex-dev/presence/react";
import {
  EditorContent,
  EditorProvider,
  useCurrentEditor,
} from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { HomeIcon } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Throttled last-edit signal for the docs index (~5s while actively editing).
 * Ignores collab receives (`addToHistory: false`) so remote/agent sync does
 * not attribute last-edit to the focused local viewer. Display name is
 * derived server-side from auth / localOwnerId.
 */
function DocumentTouch({
  docId,
  localOwnerId: localId,
}: {
  docId: Id<"documents">;
  localOwnerId?: string;
}) {
  const { editor } = useCurrentEditor();
  const touch = useMutation(api.documents.touch);
  const lastTouchRef = useRef(0);

  useEffect(() => {
    if (!editor || !localId) return;

    const onUpdate = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged || !editor.isFocused) return;
      // prosemirror-collab receiveTransaction sets addToHistory: false.
      if (transaction.getMeta("addToHistory") === false) return;
      const now = Date.now();
      if (now - lastTouchRef.current < TOUCH_THROTTLE_MS) return;
      lastTouchRef.current = now;
      void touch({ docId, localOwnerId: localId });
    };

    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [docId, editor, localId, touch]);

  return null;
}

// Fallbacks for the first paint, before the action can be measured.
const COMMENT_BTN_FALLBACK_WIDTH = 64;
const COMMENT_BTN_FALLBACK_HEIGHT = 20;
const COMMENT_BTN_MARGIN = 8;

function clampCommentButtonPosition(
  top: number,
  left: number,
  size: { width: number; height: number },
): { top: number; left: number } {
  const maxLeft = window.innerWidth - size.width - COMMENT_BTN_MARGIN;
  const maxTop = window.innerHeight - size.height - COMMENT_BTN_MARGIN;
  return {
    top: Math.min(Math.max(COMMENT_BTN_MARGIN, top), Math.max(COMMENT_BTN_MARGIN, maxTop)),
    left: Math.min(Math.max(COMMENT_BTN_MARGIN, left), Math.max(COMMENT_BTN_MARGIN, maxLeft)),
  };
}

function SelectionCommentButton({
  onComment,
  hideOnMobile,
}: {
  onComment: (anchorText: string) => void;
  hideOnMobile: boolean;
}) {
  const { editor } = useCurrentEditor();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [anchorText, setAnchorText] = useState("");

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setPosition(null);
        return;
      }

      const text = editor.state.doc.textBetween(from, to);
      if (!text.trim()) {
        setPosition(null);
        return;
      }

      const rect = buttonRef.current?.getBoundingClientRect();
      const coords = editor.view.coordsAtPos(to);
      setPosition(
        clampCommentButtonPosition(coords.bottom + 6, coords.left, {
          width: rect?.width || COMMENT_BTN_FALLBACK_WIDTH,
          height: rect?.height || COMMENT_BTN_FALLBACK_HEIGHT,
        }),
      );
      setAnchorText(text);
    };

    update();
    editor.on("selectionUpdate", update);
    window.addEventListener("resize", update);
    return () => {
      editor.off("selectionUpdate", update);
      window.removeEventListener("resize", update);
    };
  }, [editor]);

  if (!editor || !position || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={buttonRef}
      className={`fixed z-40 ${hideOnMobile ? "hidden md:block" : ""}`}
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <TextAction variant="primary" onClick={() => onComment(anchorText)}>
        Comment
      </TextAction>
    </div>,
    document.body,
  );
}

function EditorHighlights({
  intents,
  comments,
}: {
  intents: Array<{
    anchorText: string;
    agentName: string;
    task: string;
  }> | undefined;
  comments:
    | Array<{
        anchorText?: string;
        resolved: boolean;
        parentId?: Id<"comments">;
        authorName: string;
      }>
    | undefined;
}) {
  const { editor } = useCurrentEditor();

  useEffect(() => {
    setHighlights([
      ...(intents ?? []).map((intent) => ({
        text: intent.anchorText,
        className: "shimmer-agent",
        title: `${intent.agentName} is working: ${intent.task}`,
      })),
      ...(comments ?? [])
        .filter((c) => c.anchorText && !c.resolved && !c.parentId)
        .map((c) => ({
          text: c.anchorText!,
          className: "comment-anchor",
          title: c.authorName,
        })),
    ]);

    if (editor) {
      refreshHighlights(editor);
    }
  }, [comments, editor, intents]);

  return null;
}

export default function DocPage({
  params,
  searchParams,
}: {
  params: Promise<{ docId: string }>;
  searchParams: Promise<{ h?: string | string[] }>;
}) {
  const { docId: docIdParam } = use(params);
  const resolvedSearch = use(searchParams);
  const docId = docIdParam as Id<"documents">;
  const inviteToken = Array.isArray(resolvedSearch.h)
    ? resolvedSearch.h[0]
    : resolvedSearch.h;

  const { ownerKey, loaded: ownerLoaded } = useOwnerKey();
  const localId = ownerKey ? localOwnerId(ownerKey) : undefined;
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const user = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const displayName = resolveDisplayName({
    githubName: user?.name ?? null,
    ownerKey,
  });
  const doc = useQuery(api.documents.get, { id: docId });
  const sync = useTiptapSync(api.prosemirror, docId);
  const presenceState = usePresence(
    api.presence,
    docId,
    ownerLoaded ? displayName : "",
    10_000,
  );
  const agents = useQuery(api.agents.listForDoc, { docId });
  const intents = useQuery(api.intents.listActive, { docId });
  const comments = useQuery(api.comments.list, { docId });

  useAcceptCollaboratorInvite({
    docId,
    inviteToken,
    localId,
    ownerLoaded,
    // Skipped auth queries stay undefined — treat signed-out as settled.
    userSettled: !authLoading && (!isAuthenticated || user !== undefined),
    // Guest labels are for presence/comments only — never overwrite seat names.
    profileName: user?.name?.trim() || undefined,
  });

  const [tick, setTick] = useState(() => Date.now());
  const [shareOpen, setShareOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [composeAnchor, setComposeAnchor] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const highlightExtension = useMemo(
    () => createHighlightExtension(getHighlights),
    [],
  );

  const extensions = useMemo(() => {
    if (!sync.extension) return editorExtensions;
    return [...editorExtensions, sync.extension, highlightExtension];
  }, [highlightExtension, sync.extension]);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const onlineAgents = useMemo(
    () =>
      (agents ?? [])
        .filter((a) => !a.revoked && tick - a.lastSeenAt < LIVE_AGENT_MS)
        .map((a) => ({ ...a, online: true })),
    [agents, tick],
  );

  function handleStartComment(anchorText: string) {
    setComposeAnchor(anchorText);
    setCommentsOpen(true);
  }

  const overflowActions: Array<{
    label: string;
    onClick: () => void;
    pressed?: boolean;
  }> = [
    {
      label: "Comments",
      onClick: () => setCommentsOpen((v) => !v),
      pressed: commentsOpen,
    },
    { label: "History", onClick: () => setHistoryOpen(true) },
  ];

  if (doc === undefined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-body text-ink-tertiary">Loading…</p>
      </div>
    );
  }

  if (doc === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-body text-ink-secondary">Memo not found.</p>
        <Link href="/" className="text-body text-ink underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${commentsOpen ? "md:pr-[320px]" : ""}`}
    >
      <header className="pointer-events-none sticky top-4 z-30 flex items-start justify-between px-8 sm:top-6">
        <Link
          href="/"
          aria-label="All memos"
          title="All memos"
          className="pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-page-elevated/90 text-ink-secondary backdrop-blur-sm transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <HomeIcon className="size-3.5" />
        </Link>
        <div className="pointer-events-auto flex shrink-0 items-center gap-3">
          <AvatarStack
            humans={presenceState ?? []}
            agents={onlineAgents}
          />
          <TextAction
            variant="secondary"
            aria-label="Share"
            onClick={() => setShareOpen(true)}
          >
            Share
          </TextAction>
          <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
            <PopoverTrigger
              className={textActionClassName("secondary")}
              aria-label="More actions"
            >
              More
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="w-44 rounded-[8px] p-1"
            >
              {overflowActions.map(({ label, onClick, pressed }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={pressed}
                  className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-body tracking-[-0.15px] text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
                  onClick={() => {
                    setOverflowOpen(false);
                    onClick();
                  }}
                >
                  {label}
                  {pressed ? (
                    <span className="ml-auto text-caption text-ink-tertiary">
                      Open
                    </span>
                  ) : null}
                </button>
              ))}
              <div className="mx-1 my-1 border-t border-ink/8" />
              <Link
                href="/"
                className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-body tracking-[-0.15px] text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
                onClick={() => setOverflowOpen(false)}
              >
                All memos
              </Link>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-8 pt-10 pb-20 sm:pt-16 sm:pb-24">
        {sync.isLoading ? (
          <p className="text-body text-ink-tertiary">Loading…</p>
        ) : sync.initialContent !== null ? (
          <EditorProvider
            extensions={extensions}
            content={sync.initialContent}
            onCreate={({ editor }) => {
              editorRef.current = editor;
            }}
            onDestroy={() => {
              editorRef.current = null;
            }}
            editorContainerProps={{
              className: "prose-editor",
            }}
          >
            <EditorContent editor={null} />
            {ownerLoaded && localId ? (
              <DocumentTouch docId={docId} localOwnerId={localId} />
            ) : null}
            <SelectionCommentButton
              onComment={handleStartComment}
              hideOnMobile={commentsOpen}
            />
            <EditorHighlights intents={intents} comments={comments} />
          </EditorProvider>
        ) : null}
      </main>

      <CommentsPanel
        docId={docId}
        displayName={displayName}
        comments={comments}
        onlineAgents={onlineAgents}
        open={commentsOpen}
        onClose={() => {
          setCommentsOpen(false);
          setComposeAnchor(null);
        }}
        composeAnchor={composeAnchor}
        onClearCompose={() => setComposeAnchor(null)}
      />

      <HistoryPanel
        docId={docId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      <ShareDialog
        docId={docId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </div>
  );
}
