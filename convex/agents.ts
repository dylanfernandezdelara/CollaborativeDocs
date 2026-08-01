import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertCanManageDoc } from "./lib/access";

// Paper-palette accents (no teal/sea-glass — see DESIGN.md).
const AGENT_COLORS = [
  "#5f5faf",
  "#af5f87",
  "#af875f",
  "#5f875f",
  "#875faf",
  "#af5f5f",
  "#5f87af",
  "#87875f",
];

export const mint = mutation({
  args: {
    docId: v.id("documents"),
    name: v.string(),
    localOwnerId: v.optional(v.string()),
  },
  returns: v.object({
    agentId: v.id("agents"),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    await assertCanManageDoc(ctx, args.docId, args.localOwnerId);

    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .take(200);

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
  args: {
    agentId: v.id("agents"),
    localOwnerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const agent = await ctx.db.get("agents", args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }
    await assertCanManageDoc(ctx, agent.docId, args.localOwnerId);
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

export const forToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("agents"),
      docId: v.id("documents"),
      name: v.string(),
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

    return {
      _id: agent._id,
      docId: agent.docId,
      name: agent.name,
    };
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
