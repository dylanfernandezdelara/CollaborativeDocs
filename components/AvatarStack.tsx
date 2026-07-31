"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PresenceState } from "@convex-dev/presence/react";
import type { Id } from "@/convex/_generated/dataModel";

type AgentPresence = {
  _id: Id<"agents">;
  name: string;
  color: string;
  online: boolean;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PresenceAvatar({
  name,
  tooltip,
  backgroundColor,
  showDot,
}: {
  name: string;
  tooltip: string;
  backgroundColor?: string;
  showDot?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="relative">
            <Avatar
              size="sm"
              className="size-6 text-[10px]"
              style={
                backgroundColor
                  ? { backgroundColor, color: "#fff" }
                  : undefined
              }
            >
              <AvatarFallback
                className={
                  backgroundColor
                    ? "bg-transparent text-[10px] text-white"
                    : "text-[10px] text-[#5D5D5D]"
                }
              >
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            {showDot && (
              <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-[#FAFAFA] bg-[#22c55e]" />
            )}
          </div>
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function AvatarStack({
  humans,
  agents,
}: {
  humans: PresenceState[];
  agents: AgentPresence[];
}) {
  const onlineHumans = humans.filter((h) => h.online);
  const onlineAgents = agents.filter((a) => a.online);

  if (onlineHumans.length === 0 && onlineAgents.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delay={200}>
      <div className="flex shrink-0 -space-x-1.5">
        {onlineHumans.map((human) => (
          <PresenceAvatar
            key={human.userId}
            name={human.userId}
            tooltip={human.userId}
          />
        ))}
        {onlineAgents.map((agent) => (
          <PresenceAvatar
            key={agent._id}
            name={agent.name}
            tooltip={`${agent.name} (agent)`}
            backgroundColor={agent.color}
            showDot
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
