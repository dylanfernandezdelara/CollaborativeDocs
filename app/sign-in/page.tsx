import { GitHubSignInButton } from "@/components/AuthControls";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col px-4 py-12 sm:py-24">
      <Link
        href="/"
        className="w-fit text-[13px] text-ink-tertiary transition-colors hover:text-ink"
      >
        ← CollabDocs
      </Link>

      <section className="mt-16">
        <h1 className="text-[24px] font-medium text-ink">Sign in</h1>
        <p className="mt-3 max-w-[360px] text-[14px] leading-6 text-ink-secondary">
          Sync your documents across browsers and devices. You can keep using
          CollabDocs without an account.
        </p>

        <div className="mt-8">
          <GitHubSignInButton />
        </div>

        <p className="mt-4 text-[12px] leading-5 text-ink-tertiary">
          Documents created on this device will be added to your account after
          you sign in.
        </p>
      </section>
    </main>
  );
}
