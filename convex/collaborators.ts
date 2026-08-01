import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { resolveViewerId } from "./lib/owner";
import { assertCanManageDoc, canManageDoc } from "./lib/access";
import { claimInviteSeat } from "./lib/collaboratorSeats";

const MAX_NAME_LENGTH = 80;
const MAX_SEATS_PER_DOC = 200;

function mintToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

function normalizeName(raw: string | undefined): string | undefined {
  const name = raw?.trim();
  if (!name) return undefined;
  return name.slice(0, MAX_NAME_LENGTH);
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

export const mint = mutation({
  args: {
    docId: v.id("documents"),
    name: v.string(),
    localOwnerId: v.optional(v.string()),
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
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error("Name must be 80 characters or fewer");
    }

    await assertCanManageDoc(ctx, args.docId, args.localOwnerId);

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

    const result = await claimInviteSeat(
      ctx,
      invite,
      subjectId,
      normalizeName(args.displayName),
    );
    if (result.outcome === "already_used") {
      return { outcome: "already_used" as const };
    }
    return {
      outcome: "joined" as const,
      docId: invite.docId,
      collaboratorId: result.collaboratorId,
    };
  },
});

export const revoke = mutation({
  args: {
    collaboratorId: v.id("collaborators"),
    localOwnerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const collaborator = await ctx.db.get(
      "collaborators",
      args.collaboratorId,
    );
    if (!collaborator) {
      throw new Error("Collaborator not found");
    }
    await assertCanManageDoc(ctx, collaborator.docId, args.localOwnerId);
    await ctx.db.patch("collaborators", args.collaboratorId, {
      revoked: true,
    });
    return null;
  },
});

export const listForDoc = query({
  args: {
    docId: v.id("documents"),
    localOwnerId: v.optional(v.string()),
  },
  returns: v.array(collaboratorPublicValidator),
  handler: async (ctx, args) => {
    const access = await canManageDoc(ctx, args.docId, args.localOwnerId);
    if (!access || !access.allowed) {
      return [];
    }

    const people = await ctx.db
      .query("collaborators")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .take(MAX_SEATS_PER_DOC);

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
