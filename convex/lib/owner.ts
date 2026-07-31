import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export function isLocalOwnerId(ownerId: string): boolean {
  return ownerId.startsWith("local:") && ownerId.length > "local:".length;
}

export function userOwnerId(userId: string): string {
  return `user:${userId}`;
}

/** Owner id used when creating a document. */
export async function resolveCreateOwnerId(
  ctx: QueryCtx | MutationCtx,
  localOwnerId: string | undefined,
): Promise<string | null> {
  const userId = await getAuthUserId(ctx);
  if (userId) {
    return userOwnerId(userId);
  }
  if (localOwnerId && isLocalOwnerId(localOwnerId)) {
    return localOwnerId;
  }
  return null;
}

/**
 * Subject id for the current viewer: prefer signed-in user, else local cookie.
 * Used for collaborator membership (not document ownership).
 */
export async function resolveSubjectId(
  ctx: QueryCtx | MutationCtx,
  localOwnerId: string | undefined,
): Promise<string | null> {
  return await resolveCreateOwnerId(ctx, localOwnerId);
}
