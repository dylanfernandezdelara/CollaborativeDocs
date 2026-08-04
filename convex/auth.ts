import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Convex Auth reads these from the *Convex deployment* env (dashboard /
 * `npx convex env set`), not from Next `.env.local`.
 *
 * Required for GitHub OAuth:
 * - AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
 * - SITE_URL (app origin, e.g. https://collaborative-docs-bice.vercel.app)
 * - JWT_PRIVATE_KEY / JWKS (from `npx @convex-dev/auth`)
 */
export function isGitHubAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GITHUB_ID &&
      process.env.AUTH_GITHUB_SECRET &&
      process.env.SITE_URL &&
      process.env.JWT_PRIVATE_KEY &&
      process.env.JWKS,
  );
}

const githubId = process.env.AUTH_GITHUB_ID;
const githubSecret = process.env.AUTH_GITHUB_SECRET;
const githubConfigured = isGitHubAuthConfigured();

if (!githubConfigured) {
  console.error(
    "Convex Auth: GitHub sign-in is disabled. Set AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, SITE_URL, JWT_PRIVATE_KEY, and JWKS on this Convex deployment.",
  );
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Omit the provider when credentials are missing so signIn("github") fails
  // with a clear error instead of redirecting to GitHub with client_id=undefined.
  providers:
    githubConfigured && githubId && githubSecret
      ? [GitHub({ clientId: githubId, clientSecret: githubSecret })]
      : [],
});
