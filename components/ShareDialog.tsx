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
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";

type ShareDialogProps = {
  docId: Id<"documents">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type MintedInvite = {
  agentId: Id<"agents">;
  token: string;
  name: string;
};

export function ShareDialog({ docId, open, onOpenChange }: ShareDialogProps) {
  const agents = useQuery(api.agents.listForDoc, { docId });
  const mint = useMutation(api.agents.mint);
  const revoke = useMutation(api.agents.revoke);

  const [agentName, setAgentName] = useState("Agent A");
  const [minted, setMinted] = useState<MintedInvite | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [copied, setCopied] = useState<"curl" | "json" | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const letter = String.fromCharCode(65 + (agents?.length ?? 0));
      setAgentName(`Agent ${letter}`);
      setMinted(null);
      setManualOpen(false);
      setCopied(null);
    }
    onOpenChange(nextOpen);
  }

  const curlCommand = minted
    ? `curl -fsSL ${origin}/api/join/${minted.token} | sh`
    : "";

  const mcpJson = minted
    ? JSON.stringify(
        {
          mcpServers: {
            collabdocs: {
              url: `${origin}/api/mcp/${minted.token}`,
            },
          },
        },
        null,
        2,
      )
    : "";

  async function handleMint() {
    const name = agentName.trim();
    if (!name) return;
    const result = await mint({ docId, name });
    setMinted({ ...result, name });
  }

  async function copyText(text: string, kind: "curl" | "json") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border-[rgba(0,0,0,0.10)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-medium text-[#292929]">
            Share
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <section>
            <h3 className="text-[13px] font-medium text-[#292929]">
              Invite an agent
            </h3>
            <div className="mt-2 flex gap-2">
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="h-8 text-[13px]"
              />
              <Button
                onClick={() => void handleMint()}
                disabled={!agentName.trim()}
                className="shrink-0 rounded-full text-[13px]"
                size="sm"
              >
                Create invite
              </Button>
            </div>

            {minted && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-[12px] text-[#9E9E9E]">
                    One-liner install
                  </p>
                  <div className="flex items-start gap-2 rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#FAFAFA] p-2">
                    <code className="flex-1 overflow-x-auto text-[12px] text-[#5D5D5D]">
                      {curlCommand}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void copyText(curlCommand, "curl")}
                    >
                      {copied === "curl" ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
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
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-[rgba(0,0,0,0.10)] bg-[#FAFAFA] p-2">
                      <pre className="flex-1 overflow-x-auto text-[12px] text-[#5D5D5D]">
                        {mcpJson}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void copyText(mcpJson, "json")}
                      >
                        {copied === "json" ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    </div>
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
                        onClick={() => void revoke({ agentId: agent._id })}
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
