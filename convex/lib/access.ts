import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { viewerSubjectIds } from "./owner";

const MAX_SEAT_SCAN = 20;

/**
 * Explicit invite-management policy: the document owner and joined
 * collaborators may mint invites, revoke access, and read the access list.
 * Reading/editing the document body stays open to anyone with the link —
 * this only gates management surfaces.
 *
 * Documents created before ownership existed (`ownerId` unset) remain
 * manageable by anyone until an account claims them, matching their
 * pre-ownership behavior.
 */
export async function canManageDoc(
  ctx: QueryCtx | MutationCtx,
  docId: Id<"documents">,
  localOwnerId: string | undefined,
): Promise<{ doc: Doc<"documents">; allowed: boolean } | null> {
  const doc = await ctx.db.get("documents", docId);
  if (!doc || doc.deletedAt !== undefined) {
    return null;
  }
  if (!doc.ownerId) {
    return { doc, allowed: true };
  }

  const userId = await getAuthUserId(ctx);
  const subjects = viewerSubjectIds(userId, localOwnerId);
  if (subjects.includes(doc.ownerId)) {
    return { doc, allowed: true };
  }

  for (const subjectId of subjects) {
    const seats = await ctx.db
      .query("collaborators")
      .withIndex("by_doc_and_subject", (q) =>
        q.eq("docId", docId).eq("subjectId", subjectId),
      )
      .take(MAX_SEAT_SCAN);
    if (seats.some((seat) => !seat.revoked)) {
      return { doc, allowed: true };
    }
  }

  return { doc, allowed: false };
}

/** Throwing variant for mutations. */
export async function assertCanManageDoc(
  ctx: MutationCtx,
  docId: Id<"documents">,
  localOwnerId: string | undefined,
): Promise<Doc<"documents">> {
  const result = await canManageDoc(ctx, docId, localOwnerId);
  if (!result) {
    throw new Error("Memo not found");
  }
  if (!result.allowed) {
    throw new Error("Unauthorized: only the owner or collaborators can manage sharing");
  }
  return result.doc;
}
