"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  agentInviteSlug,
  agentMcpServerId,
  buildJoinCurlCommand,
} from "@/lib/agentInvite";
import { buildHumanInviteUrl } from "@/lib/humanInvite";
import { localOwnerId as toLocalOwnerId, useOwnerKey } from "@/lib/ownerKey";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";

type ShareDialogProps = {
  docId: Id<"documents">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type InviteKind = "person" | "agent";

type MintedInvite =
  | { kind: "person"; id: Id<"collaborators">; token: string; name: string }
  | { kind: "agent"; id: Id<"agents">; token: string; name: string };

type AccessRow =
  | {
      key: string;
      kind: "person";
      id: Id<"collaborators">;
      name: string;
      status: "pending" | "joined" | "revoked";
    }
  | {
      key: string;
      kind: "agent";
      id: Id<"agents">;
      name: string;
      status: "active" | "revoked";
      color: string;
    };

function SegmentedControl({
  value,
  onChange,
}: {
  value: InviteKind;
  onChange: (next: InviteKind) => void;
}) {
  const options: Array<{ id: InviteKind; label: string }> = [
    { id: "person", label: "Person" },
    { id: "agent", label: "Agent" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Invite type"
      className="inline-flex rounded-lg border border-ink/10 bg-surface-hover p-0.5"
    >
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
            className={
              selected
                ? "rounded-md bg-page-elevated px-3 py-1 text-[12px] font-medium text-ink shadow-sm"
                : "rounded-md px-3 py-1 text-[12px] text-ink-secondary hover:text-ink"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function CopyableBlock({
  text,
  copied,
  onCopy,
  multiline = false,
}: {
  text: string;
  copied: boolean;
  onCopy: () => void;
  multiline?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-ink/10 bg-page p-3 text-left transition-colors hover:border-ink/20 hover:bg-surface-hover"
    >
      {multiline ? (
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all text-[12px] leading-relaxed text-ink-secondary">
          {text}
        </pre>
      ) : (
        <code className="min-w-0 flex-1 break-all text-[12px] leading-relaxed text-ink-secondary">
          {text}
        </code>
      )}
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-page-elevated text-ink-secondary group-hover:text-ink">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </span>
    </button>
  );
}

function statusLabel(row: AccessRow): string {
  if (row.kind === "person") {
    return row.status;
  }
  return row.status === "revoked" ? "agent · revoked" : "agent";
}

export function ShareDialog({ docId, open, onOpenChange }: ShareDialogProps) {
  const { ownerKey } = useOwnerKey();
  const localId = ownerKey ? toLocalOwnerId(ownerKey) : undefined;

  const agents = useQuery(api.agents.listForDoc, open ? { docId } : "skip");
  const people = useQuery(
    api.collaborators.listForDoc,
    open ? { docId, localOwnerId: localId } : "skip",
  );
  const mintAgent = useMutation(api.agents.mint);
  const revokeAgent = useMutation(api.agents.revoke);
  const mintHuman = useMutation(api.collaborators.mint);
  const revokeHuman = useMutation(api.collaborators.revoke);

  const [inviteKind, setInviteKind] = useState<InviteKind>("person");
  const [name, setName] = useState("Collaborator");
  const [minted, setMinted] = useState<MintedInvite | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [copied, setCopied] = useState<"doc" | "invite" | "json" | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const docUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/d/${docId}`
      : "";

  function defaultNameFor(kind: InviteKind, agentCount: number): string {
    if (kind === "person") return "Collaborator";
    const letter = String.fromCharCode(65 + agentCount);
    return `Agent ${letter}`;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setInviteKind("person");
      setName(defaultNameFor("person", agents?.length ?? 0));
      setMinted(null);
      setManualOpen(false);
      setCopied(null);
    }
    onOpenChange(nextOpen);
  }

  function handleKindChange(next: InviteKind) {
    setInviteKind(next);
    setName(defaultNameFor(next, agents?.length ?? 0));
    setMinted(null);
    setManualOpen(false);
    setCopied(null);
  }

  const inviteSlug =
    minted?.kind === "agent"
      ? agentInviteSlug(minted.name, minted.token)
      : "";
  const mcpServerId = inviteSlug ? agentMcpServerId(inviteSlug) : "";

  const invitePayload =
    minted?.kind === "person"
      ? {
          label: `Invite link for ${minted.name}`,
          text: buildHumanInviteUrl(origin, docId, minted.token),
        }
      : minted?.kind === "agent"
        ? {
            label: `Start ${minted.name} — paste in a terminal`,
            text: buildJoinCurlCommand(origin, minted.token, minted.name),
          }
        : null;

  const mcpJson =
    minted?.kind === "agent"
      ? JSON.stringify(
          {
            mcpServers: {
              [mcpServerId]: {
                url: `${origin}/api/mcp/${minted.token}`,
              },
            },
          },
          null,
          2,
        )
      : "";

  const accessRows: AccessRow[] = [];
  for (const person of people ?? []) {
    accessRows.push({
      key: `person-${person._id}`,
      kind: "person",
      id: person._id,
      name: person.name,
      status: person.revoked
        ? "revoked"
        : person.joined
          ? "joined"
          : "pending",
    });
  }
  for (const agent of agents ?? []) {
    accessRows.push({
      key: `agent-${agent._id}`,
      kind: "agent",
      id: agent._id,
      name: agent.name,
      status: agent.revoked ? "revoked" : "active",
      color: agent.color,
    });
  }

  async function handleCreateInvite() {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (inviteKind === "person") {
      const result = await mintHuman({
        docId,
        name: trimmed,
        localOwnerId: localId,
      });
      setMinted({
        kind: "person",
        id: result.collaboratorId,
        token: result.token,
        name: trimmed,
      });
      return;
    }

    const result = await mintAgent({
      docId,
      name: trimmed,
      localOwnerId: localId,
    });
    setMinted({
      kind: "agent",
      id: result.agentId,
      token: result.token,
      name: trimmed,
    });
  }

  async function copyText(text: string, kind: "doc" | "invite" | "json") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,40rem)] max-w-md flex-col overflow-hidden border-ink/10 p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 px-4 pt-4 pr-12">
          <DialogTitle className="text-[14px] font-medium text-ink">
            Share
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <section>
            <p className="text-[12px] text-ink-tertiary">
              Anyone with the link can edit.
            </p>
            <div className="mt-2">
              <CopyableBlock
                text={docUrl}
                copied={copied === "doc"}
                onCopy={() => void copyText(docUrl, "doc")}
              />
            </div>
            {copied === "doc" && (
              <p className="mt-1 text-[12px] text-ink-tertiary">Link copied</p>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[13px] font-medium text-ink">Invite</h3>
              <SegmentedControl
                value={inviteKind}
                onChange={handleKindChange}
              />
            </div>

            <div className="mt-2 flex w-full min-w-0 flex-col gap-2 sm:flex-row">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="h-8 min-w-0 flex-1 text-[16px] sm:text-[13px]"
              />
              <Button
                onClick={() => void handleCreateInvite()}
                disabled={!name.trim()}
                className="w-full shrink-0 rounded-full text-[13px] sm:w-auto"
                size="sm"
              >
                Create invite
              </Button>
            </div>

            {invitePayload && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-[12px] text-ink-tertiary">
                    {invitePayload.label}
                  </p>
                  <CopyableBlock
                    text={invitePayload.text}
                    copied={copied === "invite"}
                    onCopy={() => void copyText(invitePayload.text, "invite")}
                  />
                  {copied === "invite" && (
                    <p className="mt-1 text-[12px] text-ink-tertiary">
                      Copied to clipboard
                    </p>
                  )}
                </div>

                {minted?.kind === "agent" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setManualOpen(!manualOpen)}
                      className="flex items-center gap-1 text-[12px] text-ink-secondary hover:text-ink"
                    >
                      {manualOpen ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                      Manual setup
                    </button>
                    {manualOpen && (
                      <div className="mt-2">
                        <CopyableBlock
                          text={mcpJson}
                          copied={copied === "json"}
                          onCopy={() => void copyText(mcpJson, "json")}
                          multiline
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-ink">On this doc</h3>
            {!accessRows.length ? (
              <p className="mt-2 text-[12px] text-ink-tertiary">
                No one invited yet.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-ink/8">
                {accessRows.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {row.kind === "agent" ? (
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                      ) : (
                        <span className="size-2 shrink-0 rounded-full bg-ink-tertiary/40" />
                      )}
                      <span className="truncate text-[13px] text-ink">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-[12px] text-ink-tertiary">
                        {statusLabel(row)}
                      </span>
                    </div>
                    {row.status !== "revoked" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-[12px] text-ink-secondary"
                        onClick={() => {
                          if (row.kind === "person") {
                            void revokeHuman({
                              collaboratorId: row.id,
                              localOwnerId: localId,
                            });
                          } else {
                            void revokeAgent({
                              agentId: row.id,
                              localOwnerId: localId,
                            });
                          }
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
