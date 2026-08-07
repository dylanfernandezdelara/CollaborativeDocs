/**
 * Convex Auth reads these from the *Convex deployment* env (dashboard /
 * `npx convex env set`), not from Next `.env.local`.
 *
 * Required for GitHub OAuth:
 * - AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
 * - SITE_URL (app origin, e.g. https://collaborative-docs-bice.vercel.app)
 * - JWT_PRIVATE_KEY / JWKS (from `npx @convex-dev/auth`)
 */
export type GitHubAuthConfig = {
  clientId: string;
  clientSecret: string;
};

function readGitHubAuthConfig(): GitHubAuthConfig | null {
  const clientId = process.env.AUTH_GITHUB_ID;
  const clientSecret = process.env.AUTH_GITHUB_SECRET;
  if (
    !clientId ||
    !clientSecret ||
    !process.env.SITE_URL ||
    !process.env.JWT_PRIVATE_KEY ||
    !process.env.JWKS
  ) {
    return null;
  }
  return { clientId, clientSecret };
}

/**
 * Captured once per isolate so provider registration and the public
 * availability query stay in sync. After setting env vars, Convex must
 * reload functions (env set / deploy) before GitHub sign-in appears.
 */
export const githubAuthConfig: GitHubAuthConfig | null = readGitHubAuthConfig();
