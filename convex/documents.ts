import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { prosemirrorSync } from "./prosemirror";
import { markdownToPmNodes } from "./lib/markdown";
import {
  isClaimableLocalOwnerId,
  isLocalOwnerId,
  resolveViewerId,
  userOwnerId,
  viewerSubjectIds,
} from "./lib/owner";
import { rebindSeat } from "./lib/collaboratorSeats";
import {
  normalizeEditorName,
  recordLastEdit,
} from "./lib/lastEdit";
import { PURGE_PHASES, runPurgeStep } from "./lib/purgeDocument";
import { guestDisplayName } from "../lib/displayName";
import type { Doc, Id } from "./_generated/dataModel";

const CLAIM_BATCH_SIZE = 100;
/** Soft server throttle so repeated touches from one editor do not thrash. */
const TOUCH_MIN_INTERVAL_MS = 2_000;

const purgePhaseValidator = v.union(
  v.literal("agents"),
  v.literal("intents"),
  v.literal("collaborators"),
  v.literal("comments"),
  v.literal("edits"),
  v.literal("finalize"),
);

const SEED_MARKDOWN = `# Product Roadmap

This memo tracks our product milestones for the second half of 2026. Each milestone has an owner and a target date.

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

const agentHeartbeatValidator = v.object({
  name: v.string(),
  lastSeenAt: v.number(),
});

const documentListItemValidator = v.object({
  _id: v.id("documents"),
  _creationTime: v.number(),
  title: v.string(),
  createdAt: v.number(),
  isYours: v.boolean(),
  ownerName: v.union(v.string(), v.null()),
  lastEditedAt: v.optional(v.number()),
  lastEditorName: v.optional(v.string()),
  lastEditorIsAgent: v.optional(v.boolean()),
  /** Non-revoked agents with raw timestamps — client filters liveness. */
  agentHeartbeats: v.array(agentHeartbeatValidator),
});

function toPublicDoc(doc: Doc<"documents">) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    title: doc.title,
    createdAt: doc.createdAt,
  };
}

/** Resolve display name for a `user:<id>` owner; `local:` stays null for the UI. */
async function resolveOwnerName(
  ctx: QueryCtx,
  ownerId: string | undefined,
): Promise<string | null> {
  if (!ownerId || ownerId.startsWith("local:")) {
    return null;
  }
  if (!ownerId.startsWith("user:")) {
    return null;
  }
  const userId = ownerId.slice("user:".length) as Id<"users">;
  const user = await ctx.db.get("users", userId);
  return user?.name ?? null;
}

async function agentHeartbeatsForDoc(
  ctx: QueryCtx,
  docId: Id<"documents">,
): Promise<Array<{ name: string; lastSeenAt: number }>> {
  const agents = await ctx.db
    .query("agents")
    .withIndex("by_doc", (q) => q.eq("docId", docId))
    .collect();
  return agents
    .filter((agent) => !agent.revoked)
    .map((agent) => ({ name: agent.name, lastSeenAt: agent.lastSeenAt }));
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
    if (document.deletedAt !== undefined) continue;
    await ctx.db.patch("documents", document._id, {
      ownerId: claim.userOwnerId,
    });
  }
  for (const collaboration of collaborations) {
    // Local seats are folded into the account identity; the source row is
    // deleted so the local subject stops matching future claim batches.
    await rebindSeat(ctx, collaboration, claim.userOwnerId, {
      retire: "delete",
    });
  }

  return {
    claimedDocuments: documents.length,
    claimedCollaborations: collaborations.length,
    done:
      documents.length < CLAIM_BATCH_SIZE &&
      collaborations.length < CLAIM_BATCH_SIZE,
  };
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
    throw new Error("Failed to start memo sync");
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

/**
 * Owner-only delete from the documents index (swipe-to-delete).
 * Tombstones immediately so the list drops the row, then schedules a bounded
 * cascade purge (same continuation pattern as identity claim).
 */
export const remove = mutation({
  args: {
    docId: v.id("documents"),
    localOwnerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("documents", args.docId);
    if (!doc) {
      throw new Error("Memo not found");
    }
    if (doc.deletedAt !== undefined) {
      return null;
    }
    if (!doc.ownerId) {
      throw new Error("Unauthorized: only the owner can delete this memo");
    }

    const userId = await getAuthUserId(ctx);
    const subjects = viewerSubjectIds(userId, args.localOwnerId);
    if (!subjects.includes(doc.ownerId)) {
      throw new Error("Unauthorized: only the owner can delete this memo");
    }

    await ctx.db.patch("documents", args.docId, { deletedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.documents.purgeStep, {
      docId: args.docId,
      phase: PURGE_PHASES[0],
    });
    return null;
  },
});

/** Bounded cascade step — reschedules itself until the document row is gone. */
export const purgeStep = internalMutation({
  args: {
    docId: v.id("documents"),
    phase: purgePhaseValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const next = await runPurgeStep(ctx, args.docId, args.phase);
    if (next !== "done") {
      await ctx.scheduler.runAfter(0, internal.documents.purgeStep, {
        docId: args.docId,
        phase: next,
      });
    }
    return null;
  },
});

/** How many document rows to tombstone + schedule per `startPurgeAll` step. */
const PURGE_ALL_BATCH = 25;

/**
 * One-shot admin cleanup: tombstone every document and schedule the existing
 * cascade purge. Invoked from the production Vercel build (deploy key), not
 * from the client. Reschedules itself until the table is empty.
 */
export const startPurgeAll = internalMutation({
  args: {},
  returns: v.object({
    queued: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").take(PURGE_ALL_BATCH);
    let queued = 0;
    const now = Date.now();
    for (const doc of docs) {
      if (doc.deletedAt === undefined) {
        await ctx.db.patch("documents", doc._id, { deletedAt: now });
      }
      await ctx.scheduler.runAfter(0, internal.documents.purgeStep, {
        docId: doc._id,
        phase: PURGE_PHASES[0],
      });
      queued += 1;
    }
    if (docs.length >= PURGE_ALL_BATCH) {
      await ctx.scheduler.runAfter(0, internal.documents.startPurgeAll, {});
      return { queued, done: false };
    }
    return { queued, done: true };
  },
});

export const list = query({
  args: {
    localOwnerId: v.optional(v.string()),
  },
  returns: v.array(documentListItemValidator),
  handler: async (ctx, args) => {
    const byId = new Map<string, Doc<"documents">>();
    const userId = await getAuthUserId(ctx);
    const subjectIds = viewerSubjectIds(userId, args.localOwnerId);

    // Legacy docs created before ownership shipped have no ownerId. They were
    // visible to everyone then, so keep them on the home list rather than
    // silently dropping pre-existing production content.
    const legacyDocs = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", undefined))
      .order("desc")
      .take(50);
    for (const doc of legacyDocs) {
      byId.set(doc._id, doc);
    }

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

    const docs = [...byId.values()]
      .filter((doc) => doc.deletedAt === undefined)
      .sort(
        (a, b) =>
          (b.lastEditedAt ?? b.createdAt) - (a.lastEditedAt ?? a.createdAt),
      )
      .slice(0, 50);

    return await Promise.all(
      docs.map(async (doc) => {
        // Legacy ownerless docs are on every viewer's list — do not broadcast
        // who is editing or which agents are live (same rationale as skipping
        // human presence rooms on the index).
        const exposeActivity = doc.ownerId !== undefined;
        const [ownerName, agentHeartbeats] = await Promise.all([
          resolveOwnerName(ctx, doc.ownerId),
          exposeActivity
            ? agentHeartbeatsForDoc(ctx, doc._id)
            : Promise.resolve([]),
        ]);
        return {
          ...toPublicDoc(doc),
          isYours: !!doc.ownerId && subjectIds.includes(doc.ownerId),
          ownerName,
          lastEditedAt: exposeActivity ? doc.lastEditedAt : undefined,
          lastEditorName: exposeActivity ? doc.lastEditorName : undefined,
          lastEditorIsAgent: exposeActivity ? doc.lastEditorIsAgent : undefined,
          agentHeartbeats,
        };
      }),
    );
  },
});

/**
 * Human last-edit signal for the docs index. Body editing stays open-by-link
 * (same as prosemirror sync / documents.get). Display name is derived server-
 * side (auth profile or guest label from `localOwnerId`) — never client-
 * supplied. Clients cannot claim `isAgent`.
 */
export const touch = mutation({
  args: {
    docId: v.id("documents"),
    localOwnerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("documents", args.docId);
    if (!doc || doc.deletedAt !== undefined) {
      return null;
    }

    const userId = await getAuthUserId(ctx);
    let name = "";
    if (userId) {
      const user = await ctx.db.get("users", userId);
      name = normalizeEditorName(user?.name ?? "");
    }
    if (!name) {
      if (!args.localOwnerId || !isLocalOwnerId(args.localOwnerId)) {
        return null;
      }
      const ownerKey = args.localOwnerId.slice("local:".length);
      name = normalizeEditorName(guestDisplayName(ownerKey));
    }
    if (!name || name === "Guest") {
      return null;
    }

    // Always throttle — including after agent edits — so touch spam cannot
    // thrash every viewer's list by alternating identities.
    if (
      doc.lastEditedAt !== undefined &&
      Date.now() - doc.lastEditedAt < TOUCH_MIN_INTERVAL_MS
    ) {
      return null;
    }

    await recordLastEdit(ctx, args.docId, { name, isAgent: false });
    return null;
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
      throw new Error("Sign in to sync memos");
    }

    const identityClaim = await getOrCreateIdentityClaim(
      ctx,
      args.localOwnerId,
      userOwnerId(userId),
    );
    // `completedAt` only marks the previous sync pass as finished. Anonymous
    // docs created after that pass (sign out, create, sign back in) still
    // need migrating, so an explicit claim always re-runs.
    if (identityClaim.completedAt) {
      await ctx.db.patch("identityClaims", identityClaim._id, {
        completedAt: undefined,
      });
      identityClaim.completedAt = undefined;
    }
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
    if (!doc || doc.deletedAt !== undefined) {
      return null;
    }
    return toPublicDoc(doc);
  },
});
