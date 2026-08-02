#!/usr/bin/env node
/**
 * Production build entrypoint.
 *
 * On Vercel Production, when CONVEX_DEPLOY_KEY is set, push Convex functions
 * before building Next so the client never ships against a stale backend.
 * Preview / local builds skip Convex deploy (they must not mutate prod).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const isVercelProduction = process.env.VERCEL_ENV === "production";
const rawDeployKey = process.env.CONVEX_DEPLOY_KEY;
const deployKey = rawDeployKey?.trim() ?? "";
const hasDeployKey = deployKey.length > 0;
const shouldDeployConvex = isVercelProduction && hasDeployKey;

function describeDeployKey(key) {
  const hasPipe = key.includes("|");
  const [prefix = "", token = ""] = key.split("|");
  const kind = prefix.startsWith("prod:")
    ? "prod"
    : prefix.startsWith("dev:")
      ? "dev"
      : prefix.startsWith("preview:")
        ? "preview"
        : prefix.startsWith("project:")
          ? "project"
          : "unknown";
  return {
    length: key.length,
    kind,
    hasPipe,
    prefix,
    tokenLength: token.length,
    // Detect common paste mistakes without printing secrets.
    wrappedInQuotes:
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'")),
    endsWithEquals: key.endsWith("="),
  };
}

/**
 * One-shot: after this production deploy, purge every document in Convex.
 * Window closes shortly after the cleanup request (2026-08-02) so later
 * production builds do not wipe the database again. Remove this block once
 * the cleanup has landed.
 */
const ONE_SHOT_PURGE_ALL_UNTIL_MS = Date.parse("2026-08-04T12:00:00.000Z");
const shouldOneShotPurgeAll =
  shouldDeployConvex && Date.now() < ONE_SHOT_PURGE_ALL_UNTIL_MS;

if (shouldDeployConvex) {
  const info = describeDeployKey(deployKey);
  console.log("Vercel Production + CONVEX_DEPLOY_KEY — deploying Convex, then Next.js");
  console.log(
    `CONVEX_DEPLOY_KEY diagnostics: kind=${info.kind} hasPipe=${info.hasPipe} length=${info.length} tokenLength=${info.tokenLength} wrappedInQuotes=${info.wrappedInQuotes} prefix=${info.prefix}`,
  );

  if (info.kind !== "prod" || !info.hasPipe || info.tokenLength < 20) {
    console.error(
      [
        "CONVEX_DEPLOY_KEY is present but not a usable Production deploy key.",
        "Expected format: prod:<deployment-name>|<token>",
        "In Vercel, delete and re-add the variable with the full value (including the | and token).",
        "Do not wrap the value in quotes in the Vercel UI.",
      ].join("\n"),
    );
    process.exit(1);
  }

  // Pass the key via an env file so nothing shell-splits on `|`.
  const envFile = join(tmpdir(), `convex-deploy-${process.pid}.env`);
  writeFileSync(envFile, `CONVEX_DEPLOY_KEY=${deployKey}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  try {
    if (shouldOneShotPurgeAll) {
      // Deploy functions first, run the purge, then build Next — `deploy --cmd`
      // cannot insert a step between push and the Next build.
      console.log(
        "ONE-SHOT: deploying Convex, then purging all documents, then Next.js",
      );
      const deployResult = spawnSync(
        "npx",
        ["convex", "deploy", "--env-file", envFile],
        {
          stdio: "inherit",
          env: process.env,
          shell: false,
        },
      );
      if ((deployResult.status ?? 1) !== 0) {
        process.exit(deployResult.status ?? 1);
      }

      const purgeResult = spawnSync(
        "npx",
        [
          "convex",
          "run",
          "documents:startPurgeAll",
          "--env-file",
          envFile,
        ],
        {
          stdio: "inherit",
          env: process.env,
          shell: false,
        },
      );
      if ((purgeResult.status ?? 1) !== 0) {
        process.exit(purgeResult.status ?? 1);
      }

      const nextResult = spawnSync("npm", ["run", "build:next"], {
        stdio: "inherit",
        env: process.env,
        shell: false,
      });
      process.exit(nextResult.status ?? 1);
    }

    const result = spawnSync(
      "npx",
      [
        "convex",
        "deploy",
        "--env-file",
        envFile,
        "--cmd",
        "npm run build:next",
      ],
      {
        stdio: "inherit",
        env: process.env,
        shell: false,
      },
    );
    process.exit(result.status ?? 1);
  } finally {
    try {
      unlinkSync(envFile);
    } catch {
      // ignore cleanup failures
    }
  }
}

if (hasDeployKey && !isVercelProduction) {
  console.log(
    "CONVEX_DEPLOY_KEY present but VERCEL_ENV is not production — building Next.js only",
  );
} else if (!hasDeployKey) {
  console.log("No production Convex deploy — building Next.js only");
}

const result = spawnSync("npm", ["run", "build:next"], {
  stdio: "inherit",
  env: process.env,
  shell: false,
});
process.exit(result.status ?? 1);
