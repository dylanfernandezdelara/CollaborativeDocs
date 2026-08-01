import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Single home for the "one active seat per (doc, subject)" invariant.
 * Both invite acceptance (collaborators.accept) and identity migration
 * (documents.claim) route through these helpers so the merge rules cannot
 * drift apart.
 */

const MAX_SEAT_SCAN = 20;

export async function seatsForSubject(
  ctx: MutationCtx,
  docId: Id<"documents">,
  subjectId: string,
): Promise<Doc<"collaborators">[]> {
  return await ctx.db
    .query("collaborators")
    .withIndex("by_doc_and_subject", (q) =>
      q.eq("docId", docId).eq("subjectId", subjectId),
    )
    .take(MAX_SEAT_SCAN);
}

/** Keep one active seat per (doc, subject); revoke the rest. */
export async function ensureSingleActiveSeat(
  ctx: MutationCtx,
  docId: Id<"documents">,
  subjectId: string,
  preferredId: Id<"collaborators">,
): Promise<Id<"collaborators">> {
  const seats = await seatsForSubject(ctx, docId, subjectId);
  const active = seats.filter((seat) => !seat.revoked);
  if (active.length <= 1) {
    return active[0]?._id ?? preferredId;
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

/**
 * Re-point a seat at a new subject, merging with any seat the subject
 * already holds on the document. `retire` controls the source row when it
 * merges into an existing seat: invite rows are revoked (keeps the audit
 * trail), migrated local seats are deleted (the subject changed identity,
 * the row is now noise).
 */
export async function rebindSeat(
  ctx: MutationCtx,
  seat: Doc<"collaborators">,
  subjectId: string,
  options: { displayName?: string; retire: "revoke" | "delete" },
): Promise<Id<"collaborators">> {
  const existing = (await seatsForSubject(ctx, seat.docId, subjectId)).filter(
    (other) => other._id !== seat._id,
  );

  if (existing.length === 0) {
    const patch: { subjectId: string; joinedAt: number; name?: string } = {
      subjectId,
      joinedAt: seat.joinedAt ?? Date.now(),
    };
    if (options.displayName) {
      patch.name = options.displayName;
    }
    await ctx.db.patch("collaborators", seat._id, patch);
    return await ensureSingleActiveSeat(ctx, seat.docId, subjectId, seat._id);
  }

  const keeper =
    existing.find((other) => !other.revoked) ??
    existing.sort((a, b) => a.createdAt - b.createdAt)[0]!;

  if (!seat.revoked) {
    // Prefer the acceptor's profile name, else the source seat's label when
    // it is fresher (migrations always; invite accepts when reviving a
    // revoked seat), else keep the existing seat name.
    const sourceNameWins = options.retire === "delete" || keeper.revoked;
    await ctx.db.patch("collaborators", keeper._id, {
      revoked: false,
      name:
        options.displayName ??
        ((sourceNameWins ? seat.name : keeper.name) || keeper.name),
      joinedAt: keeper.joinedAt ?? seat.joinedAt ?? Date.now(),
    });
  }

  if (options.retire === "delete") {
    await ctx.db.delete("collaborators", seat._id);
  } else {
    await ctx.db.patch("collaborators", seat._id, { revoked: true });
  }

  return await ensureSingleActiveSeat(ctx, seat.docId, subjectId, keeper._id);
}

export type ClaimInviteResult =
  | { outcome: "joined"; collaboratorId: Id<"collaborators"> }
  | { outcome: "already_used" };

/** One membership model for accepting an invite token as `subjectId`. */
export async function claimInviteSeat(
  ctx: MutationCtx,
  invite: Doc<"collaborators">,
  subjectId: string,
  displayName: string | undefined,
): Promise<ClaimInviteResult> {
  if (invite.subjectId === subjectId) {
    if (displayName && displayName !== invite.name) {
      await ctx.db.patch("collaborators", invite._id, { name: displayName });
    }
    const collaboratorId = await ensureSingleActiveSeat(
      ctx,
      invite.docId,
      subjectId,
      invite._id,
    );
    return { outcome: "joined", collaboratorId };
  }

  if (invite.subjectId) {
    return { outcome: "already_used" };
  }

  const collaboratorId = await rebindSeat(ctx, invite, subjectId, {
    displayName,
    retire: "revoke",
  });
  return { outcome: "joined", collaboratorId };
}
