"use client";

import { TextAction } from "@/components/TextAction";
import { DotsSpinner } from "@/components/TypingIndicator";
import { api } from "@/convex/_generated/api";
import { rememberAuthProvider, useLastAuthProvider } from "@/lib/lastAuthProvider";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";

export function AuthNav() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    rememberAuthProvider("github");
  }, [isAuthenticated]);

  if (isLoading) {
    return <span className="h-7 w-14" aria-hidden="true" />;
  }

  if (!isAuthenticated) {
    return (
      <TextAction href="/sign-in" variant="secondary">
        Sign in
      </TextAction>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="max-w-32 truncate text-label tracking-[-0.15px] text-ink-tertiary">
        {user?.name ?? user?.email ?? "Signed in"}
      </span>
      <TextAction
        variant="secondary"
        disabled={signingOut}
        aria-busy={signingOut || undefined}
        onClick={() => {
          setSigningOut(true);
          void signOut().finally(() => setSigningOut(false));
        }}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </TextAction>
    </div>
  );
}

export function GitHubSignInButton() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const lastProvider = useLastAuthProvider();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (isAuthenticated) {
    return (
      <TextAction href="/" variant="primary">
        Go to memos
      </TextAction>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <TextAction
          variant="primary"
          disabled={isLoading || pending}
          aria-busy={pending || undefined}
          onClick={() => {
            setPending(true);
            setFailed(false);
            // Keep the pending state on success — the browser is about to
            // navigate to GitHub, and flipping the label back first reads
            // as if the tap did nothing.
            void signIn("github", { redirectTo: "/" }).catch(() => {
              setFailed(true);
              setPending(false);
            });
          }}
        >
          {pending ? "Opening GitHub…" : "Continue with GitHub"}
        </TextAction>
        {pending ? (
          <DotsSpinner />
        ) : lastProvider === "github" ? (
          <span className="text-caption tracking-[-0.15px] text-ink-tertiary">
            Last used
          </span>
        ) : null}
      </div>
      <p
        role="status"
        className="mt-2 text-caption tracking-[-0.15px] text-ink-secondary empty:mt-0"
      >
        {failed ? "Couldn’t reach GitHub. Try again." : null}
      </p>
    </div>
  );
}
