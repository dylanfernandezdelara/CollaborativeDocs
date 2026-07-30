import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAgentByToken } from "./lib/agentAuth";

export const add = mutation({
  args: {
    docId: v.id("documents"),
    authorName: v.string(),
    anchorText: v.optional(v.string()),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    token: v.optional(v.string()),
  },
  returns: v.id("comments"),
  handler: async (ctx, args) => {
    let authorName = args.authorName;
    let agentId: import("./_generated/dataModel").Id<"agents"> | undefined =
      undefined;

    if (args.token) {
      const agent = await getAgentByToken(ctx, args.token);
      if (agent) {
        agentId = agent._id;
        authorName = agent.name;
        await ctx.db.patch("agents", agent._id, { lastSeenAt: Date.now() });
      }
    }

    return await ctx.db.insert("comments", {
      docId: args.docId,
      parentId: args.parentId,
      authorName,
      agentId,
      anchorText: args.anchorText,
      text: args.text,
      resolved: false,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { docId: v.id("documents") },
  returns: v.array(
    v.object({
      _id: v.id("comments"),
      _creationTime: v.number(),
      docId: v.id("documents"),
      parentId: v.optional(v.id("comments")),
      authorName: v.string(),
      agentId: v.optional(v.id("agents")),
      anchorText: v.optional(v.string()),
      text: v.string(),
      resolved: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();

    return comments.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const resolve = mutation({
  args: { commentId: v.id("comments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const comment = await ctx.db.get("comments", args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }
    await ctx.db.patch("comments", args.commentId, { resolved: true });
    return null;
  },
});

export const sendToAgent = mutation({
  args: {
    commentId: v.id("comments"),
    agentId: v.id("agents"),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    const root = await ctx.db.get("comments", args.commentId);
    if (!root) {
      throw new Error("Comment not found");
    }

    const agent = await ctx.db.get("agents", args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const allComments = await ctx.db
      .query("comments")
      .withIndex("by_doc", (q) => q.eq("docId", root.docId))
      .collect();

    const thread = allComments
      .filter((c) => c._id === root._id || c.parentId === root._id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(({ authorName, text, createdAt }) => ({
        authorName,
        text,
        createdAt,
      }));

    const payload = JSON.stringify({
      kind: "comment",
      anchorText: root.anchorText,
      thread,
    });

    return await ctx.db.insert("notifications", {
      agentId: args.agentId,
      docId: root.docId,
      kind: "comment",
      payload,
      createdAt: Date.now(),
    });
  },
});
