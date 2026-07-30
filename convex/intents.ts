import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAgentByToken } from "./lib/agentAuth";

export const declare = mutation({
  args: {
    token: v.string(),
    task: v.string(),
    anchorText: v.string(),
  },
  returns: v.id("intents"),
  handler: async (ctx, args) => {
    const agent = await getAgentByToken(ctx, args.token);
    if (!agent) {
      throw new Error("Invalid or revoked agent token");
    }

    const previousIntents = await ctx.db
      .query("intents")
      .withIndex("by_agent", (q) =>
        q.eq("agentId", agent._id).eq("active", true),
      )
      .collect();

    for (const intent of previousIntents) {
      await ctx.db.patch("intents", intent._id, { active: false });
    }

    const intentId = await ctx.db.insert("intents", {
      docId: agent.docId,
      agentId: agent._id,
      task: args.task,
      anchorText: args.anchorText,
      active: true,
      createdAt: Date.now(),
    });

    await ctx.db.patch("agents", agent._id, { lastSeenAt: Date.now() });
    return intentId;
  },
});

export const listActive = query({
  args: { docId: v.id("documents") },
  returns: v.array(
    v.object({
      _id: v.id("intents"),
      task: v.string(),
      anchorText: v.string(),
      agentId: v.id("agents"),
      agentName: v.string(),
      agentColor: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const intents = await ctx.db
      .query("intents")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId).eq("active", true))
      .collect();

    const results = [];
    for (const intent of intents) {
      const agent = await ctx.db.get("agents", intent.agentId);
      if (!agent) {
        continue;
      }
      results.push({
        _id: intent._id,
        task: intent.task,
        anchorText: intent.anchorText,
        agentId: intent.agentId,
        agentName: agent.name,
        agentColor: agent.color,
        createdAt: intent.createdAt,
      });
    }

    return results;
  },
});

export const clearForAgentInternal = internalMutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const activeIntents = await ctx.db
      .query("intents")
      .withIndex("by_agent", (q) =>
        q.eq("agentId", args.agentId).eq("active", true),
      )
      .collect();

    for (const intent of activeIntents) {
      await ctx.db.patch("intents", intent._id, { active: false });
    }

    return null;
  },
});
