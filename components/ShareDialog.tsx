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

type MintedAgentInvite = {
  agentId: Id<"agents">;
  token: string;
  name: string;
};

type MintedHumanInvite = {
  collaboratorId: Id<"collaborators">;
  token: string;
  name: string;
};

export function ShareDialog({ docId, open, onOpenChange }: ShareDialogProps) {
  const agents = useQuery(api.agents.listForDoc, { docId });
  const people = useQuery(api.collaborators.listForDoc, { docId });
  const mintAgent = useMutation(api.agents.mint);
  const revokeAgent = useMutation(api.agents.revoke);
  const mintHuman = useMutation(api.collaborators.mint);
  const revokeHuman = useMutation(api.collaborators.revoke);

  const [personName, setPersonName] = useState("Collaborator");
  const [mintedHuman, setMintedHuman] = useState<MintedHumanInvite | null>(
    null,
  );
  const [agentName, setAgentName] = useState("Agent A");
  const [mintedAgent, setMintedAgent] = useState<MintedAgentInvite | null>(
    null,
  );
  const [manualOpen, setManualOpen] = useState(false);
  const [copied, setCopied] = useState<
    "doc" | "human" | "curl" | "json" | null
  >(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const docUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/d/${docId}`
      : "";

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const letter = String.fromCharCode(65 + (agents?.length ?? 0));
      setAgentName(`Agent ${letter}`);
      setPersonName("Collaborator");
      setMintedAgent(null);
      setMintedHuman(null);
      setManualOpen(false);
      setCopied(null);
    }
    onOpenChange(nextOpen);
  }

  const inviteSlug = mintedAgent
    ? agentInviteSlug(mintedAgent.name, mintedAgent.token)
    : "";
  const mcpServerId = inviteSlug ? agentMcpServerId(inviteSlug) : "";

  const curlCommand = mintedAgent
    ? buildJoinCurlCommand(origin, mintedAgent.token, mintedAgent.name)
    : "";

  const mcpJson = mintedAgent
    ? JSON.stringify(
        {
          mcpServers: {
            [mcpServerId]: {
              url: `${origin}/api/mcp/${mintedAgent.token}`,
            },
          },
        },
        null,
        2,
      )
    : "";

  const humanInviteUrl = mintedHuman
    ? buildHumanInviteUrl(origin, docId, mintedHuman.token)
    : "";

  async function handleMintHuman() {
    const name = personName.trim();
    if (!name) return;
    const result = await mintHuman({ docId, name });
    setMintedHuman({ ...result, name });
  }

  async function handleMintAgent() {
    const name = agentName.trim();
    if (!name) return;
    const result = await mintAgent({ docId, name });
    setMintedAgent({ ...result, name });
  }

  async function copyText(
    text: string,
    kind: "doc" | "human" | "curl" | "json",
  ) {
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
            <h3 className="text-[13px] font-medium text-[#292929]">
              Invite people
            </h3>
            <p className="mt-1 text-[12px] text-[#9E9E9E]">
              Anyone with the link can edit. Named invites track collaborators
              and add the doc to their home list.
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
              <p className="mt-1 text-[12px] text-[#9E9E9E]">
                Link copied
              </p>
            )}

            <div className="mt-3 flex w-full min-w-0 gap-2">
              <Input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Name"
                className="h-8 min-w-0 flex-1 text-[13px]"
              />
              <Button
                onClick={() => void handleMintHuman()}
                disabled={!personName.trim()}
                className="shrink-0 rounded-full text-[13px]"
                size="sm"
              >
                Add person
              </Button>
            </div>

            {mintedHuman && (
              <div className="mt-3">
                <p className="mb-1 text-[12px] text-[#9E9E9E]">
                  Invite link for {mintedHuman.name}
                </p>
                <button
                  type="button"
                  onClick={() => void copyText(humanInviteUrl, "human")}
                  className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#FAFAFA] p-3 text-left transition-colors hover:border-[rgba(0,0,0,0.20)] hover:bg-[#F2F2F1]"
                >
                  <code className="min-w-0 flex-1 break-all text-[12px] leading-relaxed text-[#5D5D5D]">
                    {humanInviteUrl}
                  </code>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[rgba(0,0,0,0.10)] bg-white text-[#5D5D5D] group-hover:text-[#292929]">
                    {copied === "human" ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </span>
                </button>
                {copied === "human" && (
                  <p className="mt-1 text-[12px] text-[#9E9E9E]">
                    Copied to clipboard
                  </p>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-[#292929]">
              People on this doc
            </h3>
            {!people?.length ? (
              <p className="mt-2 text-[12px] text-[#9E9E9E]">
                No people invited yet.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[rgba(0,0,0,0.08)]">
                {people.map((person) => (
                  <li
                    key={person._id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-[13px] text-[#292929]">
                        {person.name}
                      </span>
                      <span className="ml-2 text-[12px] text-[#9E9E9E]">
                        {person.revoked
                          ? "revoked"
                          : person.joined
                            ? "joined"
                            : "pending"}
                      </span>
                    </div>
                    {!person.revoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-[12px] text-[#5D5D5D]"
                        onClick={() =>
                          void revokeHuman({ collaboratorId: person._id })
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-[#292929]">
              Invite an agent
            </h3>
            <div className="mt-2 flex w-full min-w-0 gap-2">
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="h-8 min-w-0 flex-1 text-[13px]"
              />
              <Button
                onClick={() => void handleMintAgent()}
                disabled={!agentName.trim()}
                className="shrink-0 rounded-full text-[13px]"
                size="sm"
              >
                Create invite
              </Button>
            </div>

            {mintedAgent && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-[12px] text-[#9E9E9E]">
                    Start {mintedAgent.name} — paste in a terminal
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyText(curlCommand, "curl")}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#FAFAFA] p-3 text-left transition-colors hover:border-[rgba(0,0,0,0.20)] hover:bg-[#F2F2F1]"
                  >
                    <code className="min-w-0 flex-1 break-all text-[12px] leading-relaxed text-[#5D5D5D]">
                      {curlCommand}
                    </code>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[rgba(0,0,0,0.10)] bg-white text-[#5D5D5D] group-hover:text-[#292929]">
                      {copied === "curl" ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </span>
                  </button>
                  {copied === "curl" && (
                    <p className="mt-1 text-[12px] text-[#9E9E9E]">
                      Copied to clipboard
                    </p>
                  )}
                </div>

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
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-[#292929]">
              Agents on this doc
            </h3>
            {!agents?.length ? (
              <p className="mt-2 text-[12px] text-[#9E9E9E]">No agents yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[rgba(0,0,0,0.08)]">
                {agents.map((agent) => (
                  <li
                    key={agent._id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: agent.color }}
                      />
                      <span className="text-[13px] text-[#292929]">
                        {agent.name}
                      </span>
                      {agent.revoked && (
                        <span className="text-[12px] text-[#9E9E9E]">
                          revoked
                        </span>
                      )}
                    </div>
                    {!agent.revoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[12px] text-[#5D5D5D]"
                        onClick={() => void revokeAgent({ agentId: agent._id })}
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
