import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "./prosemirror";
import { markdownToPmNodes } from "./lib/markdown";
import { resolveOwnerId } from "./lib/owner";

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

const documentValidator = v.object({
  _id: v.id("documents"),
  _creationTime: v.number(),
  title: v.string(),
  createdAt: v.number(),
  ownerId: v.string(),
});

export const create = mutation({
  args: {
    title: v.string(),
    localOwnerId: v.optional(v.string()),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const ownerId = await resolveOwnerId(ctx, args.localOwnerId);
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
  returns: v.array(documentValidator),
  handler: async (ctx, args) => {
    const ownerId = await resolveOwnerId(ctx, args.localOwnerId);
    if (!ownerId) {
      return [];
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(50);
  },
});

export const get = query({
  args: { id: v.id("documents") },
  returns: v.union(documentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("documents", args.id);
  },
});
