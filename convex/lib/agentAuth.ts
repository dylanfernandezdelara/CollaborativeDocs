import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getAgentByToken(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"agents"> | null> {
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!agent || agent.revoked) {
    return null;
  }

  return agent;
}
