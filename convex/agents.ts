import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const AGENT_COLORS = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#22c55e",
  "#0ea5e9",
];

export const mint = mutation({
  args: {
    docId: v.id("documents"),
    name: v.string(),
  },
  returns: v.object({
    agentId: v.id("agents"),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("documents", args.docId);
    if (!doc) {
      throw new Error("Document not found");
    }

    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();

    const token = (
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "")
    );
    const color = AGENT_COLORS[existingAgents.length % AGENT_COLORS.length]!;

    const agentId = await ctx.db.insert("agents", {
      docId: args.docId,
      name: args.name,
      color,
      token,
      revoked: false,
      lastSeenAt: 0,
      lastSeenVersion: 0,
      lastDigestAt: 0,
    });

    return { agentId, token };
  },
});

export const revoke = mutation({
  args: { agentId: v.id("agents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const agent = await ctx.db.get("agents", args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }
    await ctx.db.patch("agents", args.agentId, { revoked: true });
    return null;
  },
});

export const listForDoc = query({
  args: { docId: v.id("documents") },
  returns: v.array(
    v.object({
      _id: v.id("agents"),
      name: v.string(),
      color: v.string(),
      lastSeenAt: v.number(),
      revoked: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();

    return agents.map(({ _id, name, color, lastSeenAt, revoked }) => ({
      _id,
      name,
      color,
      lastSeenAt,
      revoked,
    }));
  },
});

export const byToken = internalQuery({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("agents"),
      _creationTime: v.number(),
      docId: v.id("documents"),
      name: v.string(),
      color: v.string(),
      token: v.string(),
      revoked: v.boolean(),
      lastSeenAt: v.number(),
      lastSeenVersion: v.number(),
      lastDigestAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!agent || agent.revoked) {
      return null;
    }

    return agent;
  },
});
