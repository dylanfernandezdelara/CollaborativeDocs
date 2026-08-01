import { GitHubSignInButton } from "@/components/AuthControls";
import Link from "next/link";

function DocumentVignette() {
  return (
    <div className="rounded-xl border border-border bg-page px-4 py-3.5">
      <div className="h-2 w-[55%] rounded-sm bg-ink-secondary/55" />
      <div className="mt-2.5 h-1.5 w-[90%] rounded-sm bg-ink/15" />
      <div className="mt-2.5 h-1.5 w-[78%] rounded-sm bg-ink/15" />
      <div className="mt-2.5 h-1.5 w-[84%] rounded-sm bg-ink/15" />
      <div className="mt-2.5 h-1.5 w-[40%] rounded-sm bg-ink/15" />
      <div className="mt-3 flex items-center gap-1">
        <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
          A
        </span>
        <span className="flex size-4 items-center justify-center rounded-full bg-ink-tertiary text-[9px] font-medium text-page">
          B
        </span>
        <span className="ml-1 text-[12px] text-ink-tertiary">
          2 editing now
        </span>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between border-r border-border bg-page-elevated/70 px-8 py-8 md:flex lg:px-12">
        <Link href="/" className="w-fit text-[13px] font-medium text-ink">
          CollabDocs
        </Link>
        <div className="max-w-[300px]">
          <DocumentVignette />
          <p className="mt-4 text-[13px] leading-5 text-ink-secondary">
            Documents that write themselves into sync. Everyone on the same
            page, live.
          </p>
        </div>
        <span aria-hidden="true" />
      </aside>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-[320px] md:mx-0">
          <Link
            href="/"
            className="mb-10 block w-fit text-[13px] font-medium text-ink md:hidden"
          >
            CollabDocs
          </Link>
          <h1 className="text-[24px] font-medium text-ink">Sign in</h1>
          <p className="mt-2 text-[13px] text-ink-tertiary">
            Pick up where you left off.
          </p>
          <div className="mt-6">
            <GitHubSignInButton />
          </div>
          <Link
            href="/"
            className="mt-5 inline-block text-[12px] text-ink-tertiary underline underline-offset-3 transition-colors hover:text-ink"
          >
            Continue without signing in
          </Link>
        </div>
      </section>
    </main>
  );
}
