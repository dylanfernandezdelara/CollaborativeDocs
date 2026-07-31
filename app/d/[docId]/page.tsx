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
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { editorExtensions } from "@/lib/editorExtensions";
import { resolveDisplayName } from "@/lib/displayName";
import { localOwnerId, useOwnerKey } from "@/lib/ownerKey";
import { useAcceptCollaboratorInvite } from "@/lib/useAcceptCollaboratorInvite";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import usePresence from "@convex-dev/presence/react";
import {
  EditorContent,
  EditorProvider,
  useCurrentEditor,
} from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { useConvexAuth, useQuery } from "convex/react";
import { HistoryIcon, MessageSquareIcon, ShareIcon } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Fallbacks for the first paint, before the pill can be measured.
const COMMENT_BTN_FALLBACK_WIDTH = 88;
const COMMENT_BTN_FALLBACK_HEIGHT = 32;
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
  const buttonRef = useRef<HTMLButtonElement | null>(null);
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
    <Button
      ref={buttonRef}
      size="sm"
      className={`fixed z-40 rounded-full text-[12px] shadow-sm ${
        hideOnMobile ? "hidden md:inline-flex" : ""
      }`}
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onComment(anchorText)}
    >
      Comment
    </Button>,
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
    displayName,
  });

  const [tick, setTick] = useState(() => Date.now());
  const [shareOpen, setShareOpen] = useState(false);
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
        .filter((a) => !a.revoked && tick - a.lastSeenAt < 90_000)
        .map((a) => ({ ...a, online: true })),
    [agents, tick],
  );

  function handleStartComment(anchorText: string) {
    setComposeAnchor(anchorText);
    setCommentsOpen(true);
  }

  const headerActions: Array<{
    label: string;
    icon: typeof ShareIcon;
    onClick: () => void;
    pressed?: boolean;
  }> = [
    { label: "Share", icon: ShareIcon, onClick: () => setShareOpen(true) },
    {
      label: "Comments",
      icon: MessageSquareIcon,
      onClick: () => setCommentsOpen((v) => !v),
      pressed: commentsOpen,
    },
    { label: "History", icon: HistoryIcon, onClick: () => setHistoryOpen(true) },
  ];

  if (doc === undefined) return null;

  if (doc === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-ink-secondary">Document not found.</p>
        <Link href="/" className="text-[13px] text-ink underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${commentsOpen ? "md:pr-[320px]" : ""}`}
    >
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-ink/10 bg-page/90 px-3 backdrop-blur-sm sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="shrink-0 text-[12px] text-ink-tertiary hover:text-ink-secondary"
          >
            CollabDocs
          </Link>
          <span className="truncate text-[14px] font-medium text-ink">
            {doc.title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <div className="mr-0.5 sm:mr-1">
            <AvatarStack
              humans={presenceState ?? []}
              agents={onlineAgents}
            />
          </div>
          {headerActions.map(({ label, icon: Icon, onClick, pressed }) => (
            <Button
              key={label}
              variant="ghost"
              size="sm"
              className="w-7 px-0 text-ink-secondary md:w-auto md:px-2.5"
              aria-label={label}
              aria-pressed={pressed}
              onClick={onClick}
            >
              <Icon className="size-3.5 md:hidden" />
              <span className="hidden text-[13px] md:inline">{label}</span>
            </Button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-4 pt-10 pb-20 sm:pt-16 sm:pb-24">
        {sync.isLoading ? null : sync.initialContent !== null ? (
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
