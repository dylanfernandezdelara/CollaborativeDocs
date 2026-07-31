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
      className="inline-flex rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#F2F2F1] p-0.5"
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
                ? "rounded-md bg-white px-3 py-1 text-[12px] font-medium text-[#292929] shadow-sm"
                : "rounded-md px-3 py-1 text-[12px] text-[#5D5D5D] hover:text-[#292929]"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ShareDialog({ docId, open, onOpenChange }: ShareDialogProps) {
  const agents = useQuery(api.agents.listForDoc, { docId });
  const people = useQuery(api.collaborators.listForDoc, { docId });
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
      const result = await mintHuman({ docId, name: trimmed });
      setMinted({
        kind: "person",
        id: result.collaboratorId,
        token: result.token,
        name: trimmed,
      });
      return;
    }

    const result = await mintAgent({ docId, name: trimmed });
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
      <DialogContent className="max-h-[min(90vh,720px)] max-w-md overflow-y-auto border-[rgba(0,0,0,0.10)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium text-[#292929]">
            Share
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <section>
            <p className="text-[12px] text-[#9E9E9E]">
              Anyone with the link can edit.
            </p>
            <button
              type="button"
              onClick={() => void copyText(docUrl, "doc")}
              className="group mt-2 flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#FAFAFA] p-3 text-left transition-colors hover:border-[rgba(0,0,0,0.20)] hover:bg-[#F2F2F1]"
            >
              <code className="min-w-0 flex-1 break-all text-[12px] leading-relaxed text-[#5D5D5D]">
                {docUrl}
              </code>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[rgba(0,0,0,0.10)] bg-white text-[#5D5D5D] group-hover:text-[#292929]">
                {copied === "doc" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </span>
            </button>
            {copied === "doc" && (
              <p className="mt-1 text-[12px] text-[#9E9E9E]">Link copied</p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-medium text-[#292929]">
                Invite
              </h3>
              <SegmentedControl
                value={inviteKind}
                onChange={handleKindChange}
              />
            </div>

            <div className="mt-2 flex w-full min-w-0 gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="h-8 min-w-0 flex-1 text-[13px]"
              />
              <Button
                onClick={() => void handleCreateInvite()}
                disabled={!name.trim()}
                className="shrink-0 rounded-full text-[13px]"
                size="sm"
              >
                Create invite
              </Button>
            </div>

            {invitePayload && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-[12px] text-[#9E9E9E]">
                    {invitePayload.label}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyText(invitePayload.text, "invite")}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#FAFAFA] p-3 text-left transition-colors hover:border-[rgba(0,0,0,0.20)] hover:bg-[#F2F2F1]"
                  >
                    <code className="min-w-0 flex-1 break-all text-[12px] leading-relaxed text-[#5D5D5D]">
                      {invitePayload.text}
                    </code>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[rgba(0,0,0,0.10)] bg-white text-[#5D5D5D] group-hover:text-[#292929]">
                      {copied === "invite" ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </span>
                  </button>
                  {copied === "invite" && (
                    <p className="mt-1 text-[12px] text-[#9E9E9E]">
                      Copied to clipboard
                    </p>
                  )}
                </div>

                {minted?.kind === "agent" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setManualOpen(!manualOpen)}
                      className="flex items-center gap-1 text-[12px] text-[#5D5D5D] hover:text-[#292929]"
                    >
                      {manualOpen ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                      Manual setup
                    </button>
                    {manualOpen && (
                      <button
                        type="button"
                        onClick={() => void copyText(mcpJson, "json")}
                        className="group mt-2 flex w-full cursor-pointer items-start gap-3 rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#FAFAFA] p-3 text-left transition-colors hover:border-[rgba(0,0,0,0.20)] hover:bg-[#F2F2F1]"
                      >
                        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all text-[12px] leading-relaxed text-[#5D5D5D]">
                          {mcpJson}
                        </pre>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[rgba(0,0,0,0.10)] bg-white text-[#5D5D5D] group-hover:text-[#292929]">
                          {copied === "json" ? (
                            <Check className="size-4" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-[#292929]">
              On this doc
            </h3>
            {!accessRows.length ? (
              <p className="mt-2 text-[12px] text-[#9E9E9E]">
                No one invited yet.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[rgba(0,0,0,0.08)]">
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
                        <span className="size-2 shrink-0 rounded-full bg-[#CFCFCF]" />
                      )}
                      <span className="truncate text-[13px] text-[#292929]">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-[12px] text-[#9E9E9E]">
                        {row.kind === "person"
                          ? row.status
                          : row.status === "revoked"
                            ? "agent · revoked"
                            : "agent"}
                      </span>
                    </div>
                    {row.status !== "revoked" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-[12px] text-[#5D5D5D]"
                        onClick={() => {
                          if (row.kind === "person") {
                            void revokeHuman({ collaboratorId: row.id });
                          } else {
                            void revokeAgent({ agentId: row.id });
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
