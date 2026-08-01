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

function HumanAvatar({ name }: { name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="relative">
            <Avatar size="sm" className="size-6 text-[10px]">
              <AvatarFallback className="text-[10px] text-ink-secondary">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
          </div>
        }
      />
      <TooltipContent>{name}</TooltipContent>
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
      <div className="flex shrink-0 items-center gap-2">
        {onlineHumans.length > 0 ? (
          <div className="flex shrink-0 -space-x-1.5">
            {onlineHumans.map((human) => (
              <HumanAvatar key={human.userId} name={human.userId} />
            ))}
          </div>
        ) : null}
        {onlineAgents.map((agent) => (
          <span
            key={agent._id}
            className="text-[11px] tracking-[-0.15px] text-ink-tertiary"
          >
            {agent.name} (agent)
          </span>
        ))}
      </div>
    </TooltipProvider>
  );
}
