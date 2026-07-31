"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { rememberAuthProvider, useLastAuthProvider } from "@/lib/lastAuthProvider";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.5.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.8 5.4-5.5 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .7Z"
      />
    </svg>
  );
}

export function AuthNav({ localOwnerId }: { localOwnerId?: string }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const claim = useMutation(api.documents.claim);
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    rememberAuthProvider("github");
    if (localOwnerId) {
      void claim({ localOwnerId }).catch(() => undefined);
    }
  }, [claim, isAuthenticated, localOwnerId]);

  if (isLoading) {
    return <span className="h-7 w-14" aria-hidden="true" />;
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/sign-in"
        className="rounded-lg px-2.5 py-1.5 text-[13px] text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="max-w-32 truncate text-[12px] text-ink-tertiary">
        {user?.name ?? user?.email ?? "Signed in"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={signingOut}
        className="text-[13px] text-ink-secondary"
        onClick={() => {
          setSigningOut(true);
          void signOut().finally(() => setSigningOut(false));
        }}
      >
        Sign out
      </Button>
    </div>
  );
}

export function GitHubSignInButton() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const lastProvider = useLastAuthProvider();
  const [pending, setPending] = useState(false);

  if (isAuthenticated) {
    return (
      <Link
        href="/"
        className="inline-flex h-9 items-center justify-center rounded-full bg-ink px-5 text-[13px] font-medium text-page transition-colors hover:bg-ink/80"
      >
        Go to documents
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      size="lg"
      className="relative h-10 w-full justify-center rounded-lg bg-ink px-3 text-[14px] text-page hover:bg-ink/80"
      disabled={isLoading || pending}
      onClick={() => {
        setPending(true);
        void signIn("github", { redirectTo: "/" }).finally(() =>
          setPending(false),
        );
      }}
    >
      <span className="size-4">
        <GitHubIcon />
      </span>
      <span>{pending ? "Redirecting…" : "Continue with GitHub"}</span>
      {lastProvider === "github" ? (
        <span className="absolute top-1 right-1 rounded-full border border-ink/15 bg-page-elevated px-2 py-0.5 text-[12px] font-normal text-ink-tertiary">
          Last Used
        </span>
      ) : null}
    </Button>
  );
}
