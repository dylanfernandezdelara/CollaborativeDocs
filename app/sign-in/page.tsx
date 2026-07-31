import { GitHubSignInButton } from "@/components/AuthControls";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <Card className="gap-0 rounded-2xl bg-page/95 py-0 ring-ink/10">
          <CardHeader className="gap-2 px-6 pt-8 pb-6 text-center">
            <p className="text-[13px] font-medium text-ink-secondary">
              CollabDocs
            </p>
            <CardTitle className="text-[24px] font-medium text-ink">
              Welcome back
            </CardTitle>
            <CardDescription className="text-[14px] leading-6 text-ink-secondary">
              Sign in to sync your documents across browsers and devices.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <GitHubSignInButton />
            <p className="mt-4 text-center text-[12px] leading-5 text-ink-tertiary">
              Documents from this device are added to your account
              automatically.
            </p>
          </CardContent>

          <CardFooter className="justify-center rounded-b-2xl border-ink/8 bg-page-elevated/70 px-6 py-4">
            <Link
              href="/"
              className="text-[13px] text-ink-secondary transition-colors hover:text-ink"
            >
              Continue without signing in
            </Link>
          </CardFooter>
        </Card>

        <p className="mt-5 text-center text-[12px] text-ink-tertiary">
          Your documents still save automatically on this device.
        </p>
      </div>
    </main>
  );
}
