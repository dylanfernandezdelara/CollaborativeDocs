import { query } from "./_generated/server";
import { v } from "convex/values";

export const listForDoc = query({
  args: { docId: v.id("documents") },
  returns: v.array(
    v.object({
      _id: v.id("edits"),
      _creationTime: v.number(),
      docId: v.id("documents"),
      agentId: v.optional(v.id("agents")),
      agentName: v.string(),
      task: v.string(),
      summary: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const edits = await ctx.db
      .query("edits")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .order("desc")
      .take(100);

    return edits;
  },
});
