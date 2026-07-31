"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";

export function GitHubAuthButton() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current);
  const { signIn, signOut } = useAuthActions();
  const [pending, setPending] = useState(false);

  // Optional control only — never gate the home page on auth.
  if (isLoading) {
    return (
      <span className="text-[12px] text-[#8A9692]" aria-hidden>
        &nbsp;
      </span>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-[#8A9692]">
          {user.name ?? user.email ?? "Signed in"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[13px] text-[#51615C]"
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
      className="text-[13px] text-[#8A9692]"
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
