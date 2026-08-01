"use client";

import { api } from "@/convex/_generated/api";
import { localOwnerId, useOwnerKey } from "@/lib/ownerKey";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";

const MAX_ATTEMPTS = 3;

/**
 * Whenever a signed-in session is active, sync any documents/seats created
 * under this browser's anonymous cookie identity to the account. Mounted at
 * the provider level so it runs on every page, not just the home nav.
 */
export function SyncLocalIdentity() {
  const { isAuthenticated } = useConvexAuth();
  const { ownerKey } = useOwnerKey();
  const claim = useMutation(api.documents.claim);

  useEffect(() => {
    if (!isAuthenticated || !ownerKey) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (attempt: number) => {
      try {
        await claim({ localOwnerId: localOwnerId(ownerKey) });
      } catch (error) {
        // "Already synced to another account" is permanent; retrying spams.
        const message = error instanceof Error ? error.message : "";
        if (message.includes("another account")) {
          console.warn("Local documents belong to a different account", error);
          return;
        }
        console.error("Failed to sync local documents to account", error);
        if (!cancelled && attempt + 1 < MAX_ATTEMPTS) {
          timer = setTimeout(() => void run(attempt + 1), 2000 * (attempt + 1));
        }
      }
    };

    void run(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [claim, isAuthenticated, ownerKey]);

  return null;
}
