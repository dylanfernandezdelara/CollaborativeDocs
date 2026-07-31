import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { prosemirrorSync } from "./prosemirror";
import { markdownToPmNodes } from "./lib/markdown";
import {
  isClaimableLocalOwnerId,
  resolveViewerId,
  userOwnerId,
  viewerSubjectIds,
} from "./lib/owner";
import type { Doc } from "./_generated/dataModel";

const CLAIM_BATCH_SIZE = 100;

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

async function claimLocalIdentity(
  ctx: MutationCtx,
  claim: Doc<"identityClaims">,
) {
  const [documents, collaborations] = await Promise.all([
    ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", claim.localOwnerId))
      .take(CLAIM_BATCH_SIZE),
    ctx.db
      .query("collaborators")
      .withIndex("by_subject", (q) =>
        q.eq("subjectId", claim.localOwnerId),
      )
      .take(CLAIM_BATCH_SIZE),
  ]);

  for (const document of documents) {
    await ctx.db.patch("documents", document._id, {
      ownerId: claim.userOwnerId,
    });
  }
  for (const collaboration of collaborations) {
    await migrateCollaboratorSeat(ctx, collaboration, claim.userOwnerId);
  }

  return {
    claimedDocuments: documents.length,
    claimedCollaborations: collaborations.length,
    done:
      documents.length < CLAIM_BATCH_SIZE &&
      collaborations.length < CLAIM_BATCH_SIZE,
  };
}

async function migrateCollaboratorSeat(
  ctx: MutationCtx,
  localSeat: Doc<"collaborators">,
  userSubjectId: string,
) {
  const userSeats = await ctx.db
    .query("collaborators")
    .withIndex("by_doc_and_subject", (q) =>
      q.eq("docId", localSeat.docId).eq("subjectId", userSubjectId),
    )
    .take(20);

  if (userSeats.length === 0) {
    await ctx.db.patch("collaborators", localSeat._id, {
      subjectId: userSubjectId,
    });
    return;
  }

  const keeper =
    userSeats.find((seat) => !seat.revoked) ??
    userSeats.sort((a, b) => a.createdAt - b.createdAt)[0]!;

  if (!localSeat.revoked) {
    await ctx.db.patch("collaborators", keeper._id, {
      name: localSeat.name,
      revoked: false,
      joinedAt: keeper.joinedAt ?? localSeat.joinedAt ?? Date.now(),
    });
  }
  for (const seat of userSeats) {
    if (seat._id !== keeper._id && !seat.revoked) {
      await ctx.db.patch("collaborators", seat._id, { revoked: true });
    }
  }
  await ctx.db.delete("collaborators", localSeat._id);
}

async function getOrCreateIdentityClaim(
  ctx: MutationCtx,
  localOwnerId: string,
  accountOwnerId: string,
): Promise<Doc<"identityClaims">> {
  const existing = await ctx.db
    .query("identityClaims")
    .withIndex("by_local_owner", (q) => q.eq("localOwnerId", localOwnerId))
    .unique();
  if (existing) {
    if (existing.userOwnerId !== accountOwnerId) {
      throw new Error("This device is already synced to another account");
    }
    return existing;
  }

  const claimId = await ctx.db.insert("identityClaims", {
    localOwnerId,
    userOwnerId: accountOwnerId,
    createdAt: Date.now(),
  });
  const claim = await ctx.db.get("identityClaims", claimId);
  if (!claim) {
    throw new Error("Failed to start document sync");
  }
  return claim;
}

async function continueIdentityClaim(
  ctx: MutationCtx,
  claim: Doc<"identityClaims">,
) {
  if (claim.completedAt) {
    return {
      claimedDocuments: 0,
      claimedCollaborations: 0,
      done: true,
    };
  }

  const result = await claimLocalIdentity(ctx, claim);
  if (result.done) {
    await ctx.db.patch("identityClaims", claim._id, {
      completedAt: Date.now(),
    });
  } else {
    await ctx.scheduler.runAfter(0, internal.documents.continueClaim, {
      claimId: claim._id,
    });
  }
  return result;
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

export const claim = mutation({
  args: {
    localOwnerId: v.string(),
  },
  returns: v.object({
    claimedDocuments: v.number(),
    claimedCollaborations: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!isClaimableLocalOwnerId(args.localOwnerId)) {
      throw new Error("Invalid local identity");
    }
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Sign in to sync documents");
    }

    const identityClaim = await getOrCreateIdentityClaim(
      ctx,
      args.localOwnerId,
      userOwnerId(userId),
    );
    return await continueIdentityClaim(ctx, identityClaim);
  },
});

export const continueClaim = internalMutation({
  args: {
    claimId: v.id("identityClaims"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identityClaim = await ctx.db.get("identityClaims", args.claimId);
    if (!identityClaim) {
      return null;
    }
    await continueIdentityClaim(ctx, identityClaim);
    return null;
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
