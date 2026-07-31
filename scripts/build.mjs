#!/usr/bin/env node
/**
 * Production build entrypoint.
 *
 * When CONVEX_DEPLOY_KEY is present (Vercel / CI), push Convex functions first
 * so the Next.js client never ships against a stale backend API. Otherwise
 * fall back to a plain Next build (local / Cloud Agent anonymous Convex).
 */
import { spawnSync } from "node:child_process";

const hasDeployKey = Boolean(process.env.CONVEX_DEPLOY_KEY?.trim());

const command = hasDeployKey
  ? ["npx", "convex", "deploy", "--cmd", "npm run build:next"]
  : ["npm", "run", "build:next"];

if (hasDeployKey) {
  console.log("CONVEX_DEPLOY_KEY detected — deploying Convex, then Next.js");
} else {
  console.log("No CONVEX_DEPLOY_KEY — building Next.js only");
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
