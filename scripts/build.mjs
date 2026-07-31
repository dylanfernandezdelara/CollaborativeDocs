#!/usr/bin/env node
/**
 * Production build entrypoint.
 *
 * On Vercel Production, when CONVEX_DEPLOY_KEY is set, push Convex functions
 * before building Next so the client never ships against a stale backend.
 * Preview / local builds skip Convex deploy (they must not mutate prod).
 */
import { spawnSync } from "node:child_process";

const isVercelProduction = process.env.VERCEL_ENV === "production";
const hasDeployKey = Boolean(process.env.CONVEX_DEPLOY_KEY?.trim());
const shouldDeployConvex = isVercelProduction && hasDeployKey;

const command = shouldDeployConvex
  ? ["npx", "convex", "deploy", "--cmd", "npm run build:next"]
  : ["npm", "run", "build:next"];

if (shouldDeployConvex) {
  console.log(
    "Vercel Production + CONVEX_DEPLOY_KEY — deploying Convex, then Next.js",
  );
} else if (hasDeployKey && !isVercelProduction) {
  console.log(
    "CONVEX_DEPLOY_KEY present but VERCEL_ENV is not production — building Next.js only",
  );
} else {
  console.log("No production Convex deploy — building Next.js only");
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
