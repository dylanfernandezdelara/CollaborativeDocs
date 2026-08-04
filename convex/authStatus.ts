import { v } from "convex/values";
import { query } from "./_generated/server";
import { isGitHubAuthConfigured } from "./auth";

/** Whether this deployment has the env vars needed for GitHub sign-in. */
export const githubSignInAvailable = query({
  args: {},
  returns: v.boolean(),
  handler: async () => {
    return isGitHubAuthConfigured();
  },
});
