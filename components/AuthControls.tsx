"use client";

import { DotsSpinner } from "@/components/DotsSpinner";
import { TextAction } from "@/components/TextAction";
import { api } from "@/convex/_generated/api";
import { firstName, guestDisplayName, resolveDisplayName } from "@/lib/displayName";
import {
  MAX_GUEST_NAME_LENGTH,
  setGuestName,
  useGuestName,
} from "@/lib/guestName";
import { rememberAuthProvider, useLastAuthProvider } from "@/lib/lastAuthProvider";
import { useOwnerKey } from "@/lib/ownerKey";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

function GuestNameControl() {
  const { ownerKey, loaded } = useOwnerKey();
  const customName = useGuestName();
  const displayName = resolveDisplayName({
    customGuestName: customName,
    ownerKey,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editing]);

  function startEditing() {
    setDraft(displayName);
    setEditing(true);
  }

  function commit() {
    const fallback = guestDisplayName(ownerKey);
    const next = draft.trim() || fallback;
    setGuestName(next === fallback ? "" : next);
    setDraft(next === fallback ? fallback : next);
    setEditing(false);
  }

  function cancel() {
    setDraft(displayName);
    setEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (!loaded) {
    return <span className="h-7 w-20" aria-hidden="true" />;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) =>
          setDraft(event.target.value.slice(0, MAX_GUEST_NAME_LENGTH))
        }
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label="Your guest name"
        maxLength={MAX_GUEST_NAME_LENGTH}
        className="max-w-36 border-0 border-b border-primary bg-transparent p-0 text-label tracking-[-0.15px] text-ink caret-ink outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label="Rename guest account"
      title="Rename"
      className="max-w-32 truncate border-0 bg-transparent p-0 text-left text-label tracking-[-0.15px] text-ink-tertiary transition-colors duration-200 ease-out hover:text-ink-secondary"
    >
      {displayName}
    </button>
  );
}

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
      <div className="flex min-w-0 items-center gap-3">
        <GuestNameControl />
        <TextAction href="/sign-in" variant="secondary">
          Sign in
        </TextAction>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="max-w-32 truncate text-label tracking-[-0.15px] text-ink-tertiary">
        {firstName(user?.name) ?? user?.email ?? "Signed in"}
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
  const configPending = githubAvailable === undefined;
  const statusMessage =
    githubAvailable === false
      ? "GitHub sign-in isn't configured yet. Set AUTH_GITHUB_ID and AUTH_GITHUB_SECRET on the Convex deployment."
      : status === "failed"
        ? "Sign-in failed. Try again."
        : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <TextAction
          variant="primary"
          disabled={isLoading || pending || !canSignIn}
          aria-busy={pending || configPending || undefined}
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
          {pending
            ? "Opening GitHub…"
            : configPending
              ? "Checking GitHub…"
              : "Continue with GitHub"}
        </TextAction>
        {pending || configPending ? <DotsSpinner /> : null}
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
