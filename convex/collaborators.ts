import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveSubjectId } from "./lib/owner";

function mintToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

const collaboratorPublicValidator = v.object({
  _id: v.id("collaborators"),
  name: v.string(),
  revoked: v.boolean(),
  joined: v.boolean(),
  createdAt: v.number(),
});

export const mint = mutation({
  args: {
    docId: v.id("documents"),
    name: v.string(),
  },
  returns: v.object({
    collaboratorId: v.id("collaborators"),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) {
      throw new Error("Name is required");
    }
    if (name.length > 80) {
      throw new Error("Name must be 80 characters or fewer");
    }

    const doc = await ctx.db.get("documents", args.docId);
    if (!doc) {
      throw new Error("Document not found");
    }

    const token = mintToken();
    const collaboratorId = await ctx.db.insert("collaborators", {
      docId: args.docId,
      name,
      token,
      revoked: false,
      createdAt: Date.now(),
    });

    return { collaboratorId, token };
  },
});

export const accept = mutation({
  args: {
    token: v.string(),
    docId: v.id("documents"),
    localOwnerId: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      docId: v.id("documents"),
      collaboratorId: v.id("collaborators"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("collaborators")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invite || invite.revoked) {
      return null;
    }

    if (invite.docId !== args.docId) {
      throw new Error("Invite does not match this document");
    }

    const subjectId = await resolveSubjectId(ctx, args.localOwnerId);
    if (!subjectId) {
      throw new Error("Missing local identity");
    }

    const displayName = args.displayName?.trim();

    // Already bound to this subject — idempotent; refresh display name.
    if (invite.subjectId === subjectId) {
      if (displayName && displayName !== invite.name) {
        await ctx.db.patch("collaborators", invite._id, { name: displayName });
      }
      return { docId: invite.docId, collaboratorId: invite._id };
    }

    // Token already claimed by someone else.
    if (invite.subjectId && invite.subjectId !== subjectId) {
      throw new Error("Invite already used");
    }

    // If this subject already has a seat on the doc, reuse it and retire the
    // duplicate invite token row.
    const existing = await ctx.db
      .query("collaborators")
      .withIndex("by_doc_and_subject", (q) =>
        q.eq("docId", invite.docId).eq("subjectId", subjectId),
      )
      .unique();

    if (existing && existing._id !== invite._id) {
      if (existing.revoked) {
        await ctx.db.patch("collaborators", existing._id, {
          revoked: false,
          name: displayName || existing.name,
          joinedAt: existing.joinedAt ?? Date.now(),
        });
      } else if (displayName && displayName !== existing.name) {
        await ctx.db.patch("collaborators", existing._id, {
          name: displayName,
        });
      }
      await ctx.db.patch("collaborators", invite._id, { revoked: true });
      return { docId: existing.docId, collaboratorId: existing._id };
    }

    const patch: {
      subjectId: string;
      joinedAt: number;
      name?: string;
    } = {
      subjectId,
      joinedAt: Date.now(),
    };
    if (displayName) {
      patch.name = displayName;
    }

    await ctx.db.patch("collaborators", invite._id, patch);
    return { docId: invite.docId, collaboratorId: invite._id };
  },
});

export const revoke = mutation({
  args: { collaboratorId: v.id("collaborators") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const collaborator = await ctx.db.get(
      "collaborators",
      args.collaboratorId,
    );
    if (!collaborator) {
      throw new Error("Collaborator not found");
    }
    await ctx.db.patch("collaborators", args.collaboratorId, {
      revoked: true,
    });
    return null;
  },
});

export const listForDoc = query({
  args: { docId: v.id("documents") },
  returns: v.array(collaboratorPublicValidator),
  handler: async (ctx, args) => {
    const people = await ctx.db
      .query("collaborators")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();

    return people
      .map(({ _id, name, revoked, subjectId, createdAt }) => ({
        _id,
        name,
        revoked,
        joined: Boolean(subjectId) && !revoked,
        createdAt,
      }))
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});
