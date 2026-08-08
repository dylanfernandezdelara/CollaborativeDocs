import { v } from "convex/values";
import { query } from "./_generated/server";
import { githubAuthConfig } from "./lib/githubAuthConfig";

/** Whether this isolate registered the GitHub provider (env was present at load). */
export const githubSignInAvailable = query({
  args: {},
  returns: v.boolean(),
  handler: async () => {
    return githubAuthConfig !== null;
  },
});
