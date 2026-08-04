import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";
import { githubAuthConfig } from "./lib/githubAuthConfig";

if (!githubAuthConfig) {
  console.error(
    "Convex Auth: GitHub sign-in is disabled. Set AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, SITE_URL, JWT_PRIVATE_KEY, and JWKS on this Convex deployment.",
  );
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Omit the provider when credentials are missing so signIn("github") fails
  // with a clear error instead of redirecting to GitHub with client_id=undefined.
  providers: githubAuthConfig ? [GitHub(githubAuthConfig)] : [],
});
