import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isLocalOwnerId, userOwnerId } from "./lib/owner";

export const current = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get("users", userId);
    if (!user) {
      return null;
    }
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
    };
  },
});

/** Move anonymous cookie-owned docs onto the signed-in GitHub account. */
export const claimLocalDocuments = mutation({
  args: { localOwnerId: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!isLocalOwnerId(args.localOwnerId)) {
      throw new Error("Invalid local identity");
    }

    const ownerId = userOwnerId(userId);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.localOwnerId))
      .take(100);

    for (const doc of docs) {
      await ctx.db.patch("documents", doc._id, { ownerId });
    }

    return docs.length;
  },
});
