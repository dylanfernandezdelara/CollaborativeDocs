import { GitHubSignInButton } from "@/components/AuthControls";
import { TextAction } from "@/components/TextAction";
import Link from "next/link";

function DocumentVignette() {
  return (
    <div className="rounded-[10px] border border-border bg-page px-4 py-3.5">
      <div className="h-2 w-[55%] rounded-sm bg-ink-secondary/55" />
      <div className="mt-2.5 h-1.5 w-[90%] rounded-sm bg-ink/15" />
      <div className="mt-2.5 h-1.5 w-[78%] rounded-sm bg-ink/15" />
      <div className="mt-2.5 h-1.5 w-[84%] rounded-sm bg-ink/15" />
      <div className="mt-2.5 h-1.5 w-[40%] rounded-sm bg-ink/15" />
      <p className="mt-3 text-caption tracking-[-0.15px] text-ink-tertiary">
        A, B · 2 editing now
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between border-r border-border bg-page-elevated/70 px-8 py-8 md:flex lg:px-12">
        <Link href="/" className="w-fit text-heading font-medium tracking-[-0.15px] text-ink">
          Docs
        </Link>
        <div className="max-w-[300px]">
          <DocumentVignette />
          <p className="mt-4 text-body tracking-[-0.15px] text-ink-secondary">
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
            className="mb-10 block w-fit text-heading font-medium tracking-[-0.15px] text-ink md:hidden"
          >
            Docs
          </Link>
          <h1 className="text-title font-medium tracking-[-0.15px] text-ink">
            Sign in
          </h1>
          <p className="mt-2 text-body tracking-[-0.15px] text-ink-tertiary">
            Pick up where you left off.
          </p>
          <div className="mt-6">
            <GitHubSignInButton />
          </div>
          <div className="mt-5">
            <TextAction href="/" variant="secondary">
              Continue without signing in
            </TextAction>
          </div>
        </div>
      </section>
    </main>
  );
}
