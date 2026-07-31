import { GitHubSignInButton } from "@/components/AuthControls";
import {
  Card,
  CardContent,
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
          <CardHeader className="gap-2 px-6 pt-8 pb-5 text-center">
            <p className="text-[13px] font-medium text-ink-secondary">
              CollabDocs
            </p>
            <CardTitle className="text-[24px] font-medium text-ink">
              Sign in
            </CardTitle>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <GitHubSignInButton />
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
      </div>
    </main>
  );
}
