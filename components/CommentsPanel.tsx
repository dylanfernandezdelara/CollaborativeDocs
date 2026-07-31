"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Agent = {
  _id: Id<"agents">;
  name: string;
  color: string;
};

type CommentsPanelProps = {
  docId: Id<"documents">;
  displayName: string;
  comments: Doc<"comments">[] | undefined;
  onlineAgents: Agent[];
  open: boolean;
  onClose: () => void;
  composeAnchor: string | null;
  onClearCompose: () => void;
};

function SendToAgentButton({
  commentId,
  onlineAgents,
}: {
  commentId: Id<"comments">;
  onlineAgents: Agent[];
}) {
  const sendToAgent = useMutation(api.comments.sendToAgent);
  const [open, setOpen] = useState(false);

  if (onlineAgents.length === 0) return null;

  if (onlineAgents.length === 1) {
    const agent = onlineAgents[0]!;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[12px] text-[#5D5D5D]"
        onClick={() => void sendToAgent({ commentId, agentId: agent._id })}
      >
        Send to agent
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[12px] text-[#5D5D5D]"
          />
        }
      >
        Send to agent
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1">
        {onlineAgents.map((agent) => (
          <button
            key={agent._id}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
            onClick={() => {
              void sendToAgent({ commentId, agentId: agent._id });
              setOpen(false);
            }}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: agent.color }}
            />
            {agent.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function CommentsPanel({
  docId,
  displayName,
  comments,
  onlineAgents,
  open,
  onClose,
  composeAnchor,
  onClearCompose,
}: CommentsPanelProps) {
  const addComment = useMutation(api.comments.add);
  const [composeText, setComposeText] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  // Below md the panel covers the whole viewport, so lock body scroll while
  // it is open. On md+ it is a side rail and the page should keep scrolling.
  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      document.body.style.overflow = mql.matches ? "hidden" : "";
    };
    apply();
    mql.addEventListener("change", apply);
    return () => {
      mql.removeEventListener("change", apply);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const roots = (comments ?? []).filter((c) => !c.parentId);
  const repliesByParent = (comments ?? []).reduce<
    Record<string, Doc<"comments">[]>
  >((acc, comment) => {
    if (!comment.parentId) return acc;
    const key = comment.parentId;
    acc[key] = acc[key] ?? [];
    acc[key].push(comment);
    return acc;
  }, {});

  async function submitCompose() {
    const text = composeText.trim();
    if (!text) return;
    await addComment({
      docId,
      authorName: displayName,
      anchorText: composeAnchor ?? undefined,
      text,
    });
    setComposeText("");
    onClearCompose();
  }

  async function submitReply(parentId: Id<"comments">) {
    const text = (replyTexts[parentId] ?? "").trim();
    if (!text) return;
    await addComment({
      docId,
      authorName: displayName,
      text,
      parentId,
    });
    setReplyTexts((prev) => ({ ...prev, [parentId]: "" }));
  }

  return (
    <aside
      role="dialog"
      aria-label="Comments"
      className="fixed inset-0 z-50 flex flex-col bg-[#FAFAFA] md:inset-y-0 md:left-auto md:right-0 md:z-40 md:w-[320px] md:border-l md:border-[rgba(0,0,0,0.10)]"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[rgba(0,0,0,0.10)] px-4">
        <h2 className="text-[14px] font-medium text-[#292929]">Comments</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close comments">
          <XIcon className="size-4 text-[#9E9E9E]" />
        </Button>
      </div>

      {composeAnchor !== null && (
        <div className="border-b border-[rgba(0,0,0,0.10)] p-4">
          <p className="text-[12px] text-[#9E9E9E]">New comment on</p>
          <blockquote className="mt-1 border-l-2 border-[rgba(0,0,0,0.10)] pl-2 text-[12px] text-[#5D5D5D]">
            {composeAnchor}
          </blockquote>
          <Textarea
            autoFocus
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder="Write a comment…"
            className="mt-2 min-h-16 text-[16px] sm:text-[13px]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-full text-[13px]"
              disabled={!composeText.trim()}
              onClick={() => void submitCompose()}
            >
              Add comment
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[13px] text-[#5D5D5D]"
              onClick={() => {
                setComposeText("");
                onClearCompose();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {roots.length === 0 && composeAnchor === null && (
            <p className="text-[13px] text-[#9E9E9E]">
              Select text in the document to add a comment.
            </p>
          )}

          {roots.map((comment) => {
            const replies = repliesByParent[comment._id] ?? [];
            return (
              <div
                key={comment._id}
                className={
                  comment.resolved ? "opacity-50" : undefined
                }
              >
                {comment.anchorText && (
                  <blockquote className="mb-1 border-l-2 border-[rgba(0,0,0,0.10)] pl-2 text-[12px] text-[#9E9E9E]">
                    {comment.anchorText}
                  </blockquote>
                )}
                <p className="text-[13px] text-[#292929]">{comment.text}</p>
                <p className="mt-0.5 text-[12px] text-[#9E9E9E]">
                  {comment.authorName}
                </p>

                {replies.map((reply) => (
                  <div key={reply._id} className="ml-4 mt-3 border-l border-[rgba(0,0,0,0.08)] pl-3">
                    <p className="text-[13px] text-[#292929]">{reply.text}</p>
                    <p className="mt-0.5 text-[12px] text-[#9E9E9E]">
                      {reply.authorName}
                    </p>
                  </div>
                ))}

                {!comment.resolved && (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={replyTexts[comment._id] ?? ""}
                      onChange={(e) =>
                        setReplyTexts((prev) => ({
                          ...prev,
                          [comment._id]: e.target.value,
                        }))
                      }
                      placeholder="Reply…"
                      className="min-h-12 text-[16px] sm:text-[13px]"
                    />
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[12px] text-[#5D5D5D]"
                        disabled={!(replyTexts[comment._id] ?? "").trim()}
                        onClick={() => void submitReply(comment._id)}
                      >
                        Reply
                      </Button>
                      <SendToAgentButton
                        commentId={comment._id}
                        onlineAgents={onlineAgents}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
