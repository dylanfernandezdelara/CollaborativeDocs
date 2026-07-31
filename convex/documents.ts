import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "./prosemirror";
import { markdownToPmNodes } from "./lib/markdown";
import { resolveViewerId, viewerSubjectIds } from "./lib/owner";
import type { Doc } from "./_generated/dataModel";

const SEED_MARKDOWN = `# Product Roadmap

This document tracks our product milestones for the second half of 2026. Each milestone has an owner and a target date.

## Milestone 1: Agent Collaboration MVP

Ship a collaborative editor where AI agents and humans co-edit documents in real time, with tracked agent edits, intents, and comment threads.

## Milestone 2: Enterprise Readiness

Add permissions, audit trails, and compliance controls so teams can adopt agent-assisted editing in regulated environments.

|Milestone|Owner|Status|Target|
|---|---|---|---|
|Milestone 1|Dylan|In progress|Aug 2026|
|Milestone 2|Unassigned|Not started|Oct 2026|`;

/** Public shape — never expose ownerId (cookie UUID is the anonymous secret). */
const documentPublicValidator = v.object({
  _id: v.id("documents"),
  _creationTime: v.number(),
  title: v.string(),
  createdAt: v.number(),
});

function toPublicDoc(doc: Doc<"documents">) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    title: doc.title,
    createdAt: doc.createdAt,
  };
}

export const create = mutation({
  args: {
    title: v.string(),
    localOwnerId: v.optional(v.string()),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const ownerId = await resolveViewerId(ctx, args.localOwnerId);
    if (!ownerId) {
      throw new Error("Missing local identity");
    }

    const docId = await ctx.db.insert("documents", {
      title: args.title,
      createdAt: Date.now(),
      ownerId,
    });

    const seedContent = {
      type: "doc",
      content: markdownToPmNodes(SEED_MARKDOWN),
    };

    await prosemirrorSync.create(ctx, docId, seedContent);
    return docId;
  },
});

export const list = query({
  args: {
    localOwnerId: v.optional(v.string()),
  },
  returns: v.array(documentPublicValidator),
  handler: async (ctx, args) => {
    const byId = new Map<string, Doc<"documents">>();
    const userId = await getAuthUserId(ctx);
    const subjectIds = viewerSubjectIds(userId, args.localOwnerId);

    for (const subjectId of subjectIds) {
      const owned = await ctx.db
        .query("documents")
        .withIndex("by_owner", (q) => q.eq("ownerId", subjectId))
        .order("desc")
        .take(50);
      for (const doc of owned) {
        byId.set(doc._id, doc);
      }

      const seats = await ctx.db
        .query("collaborators")
        .withIndex("by_subject", (q) => q.eq("subjectId", subjectId))
        .take(100);
      for (const seat of seats) {
        if (seat.revoked || byId.has(seat.docId)) continue;
        const doc = await ctx.db.get("documents", seat.docId);
        if (doc) {
          byId.set(doc._id, doc);
        }
      }
    }

    return [...byId.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map(toPublicDoc);
  },
});

export const get = query({
  args: { id: v.id("documents") },
  returns: v.union(documentPublicValidator, v.null()),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("documents", args.id);
    if (!doc) {
      return null;
    }
    return toPublicDoc(doc);
  },
});
