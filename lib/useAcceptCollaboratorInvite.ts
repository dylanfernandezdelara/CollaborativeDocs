"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Options = {
  docId: Id<"documents">;
  inviteToken: string | undefined;
  localId: string | undefined;
  ownerLoaded: boolean;
  /**
   * True once we know whether a GitHub profile name is available.
   * When auth is skipped (signed out), this should be true immediately.
   */
  userSettled: boolean;
  /**
   * Authenticated profile name only. Omit auto guest labels so accept keeps
   * the inviter-chosen seat name.
   */
  profileName?: string;
};

/**
 * Accepts a human collaborator invite from `?h=` and strips the token from
 * the URL once the attempt settles (success or terminal failure).
 */
export function useAcceptCollaboratorInvite({
  docId,
  inviteToken,
  localId,
  ownerLoaded,
  userSettled,
  profileName,
}: Options) {
  const router = useRouter();
  const acceptInvite = useMutation(api.collaborators.accept);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!inviteToken || !ownerLoaded || !localId || !userSettled) return;
    if (handled.current === inviteToken) return;
    handled.current = inviteToken;

    void (async () => {
      try {
        await acceptInvite({
          token: inviteToken,
          docId,
          localOwnerId: localId,
          displayName: profileName,
        });
      } catch (error) {
        // Only retry on unexpected failures (e.g. missing identity / network).
        console.error("Failed to accept collaborator invite", error);
        handled.current = null;
        return;
      }
      // Terminal outcomes (joined / invalid / already_used / doc_mismatch)
      // always clear the token so remounts do not loop.
      router.replace(`/d/${docId}`, { scroll: false });
    })();
  }, [
    acceptInvite,
    profileName,
    docId,
    inviteToken,
    localId,
    ownerLoaded,
    router,
    userSettled,
  ]);
}
