import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { resolveViewerId } from "./lib/owner";

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

const acceptOutcomeValidator = v.object({
  outcome: v.union(
    v.literal("joined"),
    v.literal("invalid"),
    v.literal("already_used"),
    v.literal("doc_mismatch"),
  ),
  docId: v.optional(v.id("documents")),
  collaboratorId: v.optional(v.id("collaborators")),
});

async function findInviteByToken(
  ctx: MutationCtx,
  token: string,
): Promise<Doc<"collaborators"> | null> {
  return await ctx.db
    .query("collaborators")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

async function seatsForSubject(
  ctx: MutationCtx,
  docId: Id<"documents">,
  subjectId: string,
): Promise<Doc<"collaborators">[]> {
  return await ctx.db
    .query("collaborators")
    .withIndex("by_doc_and_subject", (q) =>
      q.eq("docId", docId).eq("subjectId", subjectId),
    )
    .take(20);
}

async function refreshName(
  ctx: MutationCtx,
  id: Id<"collaborators">,
  currentName: string,
  displayName: string | undefined,
) {
  // Callers must omit auto guest labels; only real profile names overwrite.
  if (displayName && displayName !== currentName) {
    await ctx.db.patch("collaborators", id, { name: displayName });
  }
}

/** Keep one active seat per (doc, subject); revoke the rest. */
async function collapseDuplicateSeats(
  ctx: MutationCtx,
  docId: Id<"documents">,
  subjectId: string,
  preferredId: Id<"collaborators">,
): Promise<Id<"collaborators">> {
  const seats = await seatsForSubject(ctx, docId, subjectId);
  const active = seats.filter((seat) => !seat.revoked);
  if (active.length <= 1) {
    return preferredId;
  }

  const keeper =
    active.find((seat) => seat._id === preferredId) ??
    active.sort((a, b) => a.createdAt - b.createdAt)[0]!;

  for (const seat of active) {
    if (seat._id !== keeper._id) {
      await ctx.db.patch("collaborators", seat._id, { revoked: true });
    }
  }
  return keeper._id;
}

async function mergeIntoExistingSeat(
  ctx: MutationCtx,
  invite: Doc<"collaborators">,
  existing: Doc<"collaborators">,
  displayName: string | undefined,
): Promise<Id<"collaborators">> {
  if (existing.revoked) {
    await ctx.db.patch("collaborators", existing._id, {
      revoked: false,
      // Prefer profile name, else this invite's chosen label, else prior seat.
      name: displayName || invite.name || existing.name,
      joinedAt: existing.joinedAt ?? Date.now(),
    });
  } else {
    await refreshName(ctx, existing._id, existing.name, displayName);
  }
  if (invite._id !== existing._id) {
    await ctx.db.patch("collaborators", invite._id, { revoked: true });
  }
  return existing._id;
}

async function bindInviteToSubject(
  ctx: MutationCtx,
  invite: Doc<"collaborators">,
  subjectId: string,
  displayName: string | undefined,
): Promise<Id<"collaborators">> {
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
  return await collapseDuplicateSeats(
    ctx,
    invite.docId,
    subjectId,
    invite._id,
  );
}

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
  returns: acceptOutcomeValidator,
  handler: async (ctx, args) => {
    const invite = await findInviteByToken(ctx, args.token);
    if (!invite || invite.revoked) {
      return { outcome: "invalid" as const };
    }

    if (invite.docId !== args.docId) {
      return { outcome: "doc_mismatch" as const };
    }

    const subjectId = await resolveViewerId(ctx, args.localOwnerId);
    if (!subjectId) {
      throw new Error("Missing local identity");
    }

    const displayName = args.displayName?.trim() || undefined;

    if (invite.subjectId === subjectId) {
      await refreshName(ctx, invite._id, invite.name, displayName);
      const collaboratorId = await collapseDuplicateSeats(
        ctx,
        invite.docId,
        subjectId,
        invite._id,
      );
      return {
        outcome: "joined" as const,
        docId: invite.docId,
        collaboratorId,
      };
    }

    if (invite.subjectId && invite.subjectId !== subjectId) {
      return { outcome: "already_used" as const };
    }

    const existingSeats = await seatsForSubject(ctx, invite.docId, subjectId);
    const existing =
      existingSeats.find((seat) => seat._id !== invite._id) ?? null;

    if (existing) {
      const collaboratorId = await mergeIntoExistingSeat(
        ctx,
        invite,
        existing,
        displayName,
      );
      const kept = await collapseDuplicateSeats(
        ctx,
        invite.docId,
        subjectId,
        collaboratorId,
      );
      return {
        outcome: "joined" as const,
        docId: invite.docId,
        collaboratorId: kept,
      };
    }

    const collaboratorId = await bindInviteToSubject(
      ctx,
      invite,
      subjectId,
      displayName,
    );
    return {
      outcome: "joined" as const,
      docId: invite.docId,
      collaboratorId,
    };
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
        // Revoked-after-join reports joined: false so the UI can show "revoked".
        joined: Boolean(subjectId) && !revoked,
        createdAt,
      }))
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});
