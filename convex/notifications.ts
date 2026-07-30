import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAgentByToken } from "./lib/agentAuth";

export const pending = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("notifications"),
      _creationTime: v.number(),
      agentId: v.id("agents"),
      docId: v.id("documents"),
      kind: v.string(),
      payload: v.string(),
      createdAt: v.number(),
      consumedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const agent = await getAgentByToken(ctx, args.token);
    if (!agent) {
      return null;
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();

    const pendingNotifications = notifications
      .filter((n) => n.consumedAt === undefined)
      .sort((a, b) => a.createdAt - b.createdAt);

    return pendingNotifications[0] ?? null;
  },
});

export const consume = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notification = await ctx.db.get("notifications", args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }
    await ctx.db.patch("notifications", args.notificationId, {
      consumedAt: Date.now(),
    });
    return null;
  },
});
