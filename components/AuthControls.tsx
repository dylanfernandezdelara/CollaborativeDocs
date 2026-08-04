"use client";

import { DotsSpinner } from "@/components/DotsSpinner";
import { TextAction } from "@/components/TextAction";
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

type SignInStatus = "idle" | "pending" | "failed";

export function GitHubSignInButton() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const lastProvider = useLastAuthProvider();
  const githubAvailable = useQuery(api.authStatus.githubSignInAvailable);
  const [status, setStatus] = useState<SignInStatus>("idle");

  // When the user abandons the GitHub page and comes back, bfcache restores
  // this page with React state intact — reset so the action isn't stuck
  // disabled on "Opening GitHub…".
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setStatus("idle");
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  if (isAuthenticated) {
    return (
      <TextAction href="/" variant="primary">
        Go to memos
      </TextAction>
    );
  }

  const pending = status === "pending";
  // Treat loading (undefined) as unavailable so we never offer a click that
  // races an empty provider list.
  const canSignIn = githubAvailable === true;
  const statusMessage =
    githubAvailable === false
      ? "GitHub sign-in isn't configured for this deployment."
      : status === "failed"
        ? "Sign-in failed. Try again."
        : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <TextAction
          variant="primary"
          disabled={isLoading || pending || !canSignIn}
          aria-busy={pending || undefined}
          onClick={() => {
            setStatus("pending");
            // Stay pending on success — the browser is about to navigate to
            // GitHub, and flipping the label back first reads as if the tap
            // did nothing.
            void signIn("github", { redirectTo: "/" }).then(
              (result) => {
                if (!result.redirect) {
                  setStatus("failed");
                }
              },
              () => setStatus("failed"),
            );
          }}
        >
          {pending ? "Opening GitHub…" : "Continue with GitHub"}
        </TextAction>
        {pending ? <DotsSpinner /> : null}
        {!pending && canSignIn && lastProvider === "github" ? (
          <span className="text-caption tracking-[-0.15px] text-ink-tertiary">
            Last used
          </span>
        ) : null}
      </div>
      <p
        role="status"
        className="mt-2 text-caption tracking-[-0.15px] text-ink-secondary empty:mt-0"
      >
        {statusMessage}
      </p>
    </div>
  );
}
