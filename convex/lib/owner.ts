import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * One validation rule for local (cookie) identities everywhere: `local:`
 * followed by a 20–200 char URL-safe key. Anything looser would let
 * ownership, membership, and claim flows disagree about the same string.
 */
export function isLocalOwnerId(ownerId: string): boolean {
  if (!ownerId.startsWith("local:")) return false;
  const key = ownerId.slice("local:".length);
  return (
    key.length >= 20 &&
    key.length <= 200 &&
    /^[A-Za-z0-9_-]+$/.test(key)
  );
}

export const isClaimableLocalOwnerId = isLocalOwnerId;

export function userOwnerId(userId: string): string {
  return `user:${userId}`;
}

/**
 * Preferred identity for the current viewer: signed-in user if present,
 * otherwise the local cookie id. Used for document ownership and
 * collaborator membership.
 */
export async function resolveViewerId(
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
 * All subject ids that should count for the current viewer on home lists.
 * Includes both GitHub and cookie identities so optional sign-in/out does
 * not hide owned or shared docs.
 */
export function viewerSubjectIds(
  userId: string | null,
  localOwnerId: string | undefined,
): string[] {
  const ids: string[] = [];
  if (userId) {
    ids.push(userOwnerId(userId));
  }
  if (localOwnerId && isLocalOwnerId(localOwnerId)) {
    ids.push(localOwnerId);
  }
  return ids;
}
