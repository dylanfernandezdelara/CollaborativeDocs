"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";

export function GitHubAuthButton() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  // Skip until authenticated — `users:current` is absent on older Convex deploys
  // and a failing useQuery crashes the whole page.
  const user = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const { signIn, signOut } = useAuthActions();
  const [pending, setPending] = useState(false);

  // Optional control only — never gate the home page on auth.
  if (isLoading) {
    return (
      <span className="text-[12px] text-ink-tertiary" aria-hidden>
        &nbsp;
      </span>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex max-w-full items-center gap-2 sm:gap-3">
        <span className="max-w-[120px] truncate text-[12px] text-ink-tertiary sm:max-w-[180px]">
          {user.name ?? user.email ?? "Signed in"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-[13px] text-ink-secondary"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void signOut().finally(() => setPending(false));
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-[13px] text-ink-tertiary"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signIn("github").finally(() => setPending(false));
      }}
    >
      {pending ? "Redirecting…" : "GitHub"}
    </Button>
  );
}
