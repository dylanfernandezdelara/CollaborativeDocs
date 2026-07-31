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
import { useOwnerKey } from "@/lib/ownerKey";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import usePresence from "@convex-dev/presence/react";
import {
  EditorContent,
  EditorProvider,
  useCurrentEditor,
} from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { useQuery } from "convex/react";
import { HistoryIcon, MessageSquareIcon, ShareIcon } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const COMMENT_BTN_WIDTH = 88;
const COMMENT_BTN_HEIGHT = 32;
const COMMENT_BTN_MARGIN = 8;

function clampCommentButtonPosition(
  top: number,
  left: number,
): { top: number; left: number } {
  if (typeof window === "undefined") return { top, left };
  const maxLeft = window.innerWidth - COMMENT_BTN_WIDTH - COMMENT_BTN_MARGIN;
  const maxTop = window.innerHeight - COMMENT_BTN_HEIGHT - COMMENT_BTN_MARGIN;
  return {
    top: Math.min(Math.max(COMMENT_BTN_MARGIN, top), Math.max(COMMENT_BTN_MARGIN, maxTop)),
    left: Math.min(Math.max(COMMENT_BTN_MARGIN, left), Math.max(COMMENT_BTN_MARGIN, maxLeft)),
  };
}

function SelectionCommentButton({
  onComment,
}: {
  onComment: (anchorText: string) => void;
}) {
  const { editor } = useCurrentEditor();
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

      const coords = editor.view.coordsAtPos(to);
      setPosition(
        clampCommentButtonPosition(coords.bottom + 6, coords.left),
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
      size="sm"
      className="fixed z-50 rounded-full text-[12px] shadow-sm"
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
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId: docIdParam } = use(params);
  const docId = docIdParam as Id<"documents">;

  const { ownerKey, loaded: ownerLoaded } = useOwnerKey();
  const user = useQuery(api.users.current);
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

  if (doc === undefined) return null;

  if (doc === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FAFAFA]">
        <p className="text-[14px] text-[#5D5D5D]">Document not found.</p>
        <Link href="/" className="text-[13px] text-[#292929] underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-[#FAFAFA] ${
        commentsOpen ? "md:pr-[320px]" : ""
      }`}
    >
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-[rgba(0,0,0,0.10)] bg-[#FAFAFA]/95 px-3 backdrop-blur-sm sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="shrink-0 text-[12px] text-[#9E9E9E] hover:text-[#5D5D5D]"
          >
            CollabDocs
          </Link>
          <span className="truncate text-[14px] font-medium text-[#292929]">
            {doc.title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <div className="mr-0.5 hidden min-[400px]:block sm:mr-1">
            <AvatarStack
              humans={presenceState ?? []}
              agents={onlineAgents}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[#5D5D5D] md:hidden"
            aria-label="Share"
            onClick={() => setShareOpen(true)}
          >
            <ShareIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-[13px] text-[#5D5D5D] md:inline-flex"
            onClick={() => setShareOpen(true)}
          >
            Share
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[#5D5D5D] md:hidden"
            aria-label="Comments"
            aria-pressed={commentsOpen}
            onClick={() => setCommentsOpen((v) => !v)}
          >
            <MessageSquareIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-[13px] text-[#5D5D5D] md:inline-flex"
            onClick={() => setCommentsOpen((v) => !v)}
          >
            Comments
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[#5D5D5D] md:hidden"
            aria-label="History"
            onClick={() => setHistoryOpen(true)}
          >
            <HistoryIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-[13px] text-[#5D5D5D] md:inline-flex"
            onClick={() => setHistoryOpen(true)}
          >
            History
          </Button>
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
            <SelectionCommentButton onComment={handleStartComment} />
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
