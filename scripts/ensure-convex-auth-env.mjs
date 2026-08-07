#!/usr/bin/env node
/**
 * Ensure Convex Auth environment variables exist on the target deployment.
 *
 * GitHub sign-in reads these from the *Convex deployment* (not Next/.env.local):
 *   AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, SITE_URL, JWT_PRIVATE_KEY, JWKS
 *
 * Usage:
 *   node scripts/ensure-convex-auth-env.mjs
 *   node scripts/ensure-convex-auth-env.mjs --env-file /tmp/convex.env
 *
 * Behavior:
 * - Always ensures JWT_PRIVATE_KEY + JWKS (generates once if missing)
 * - Sets SITE_URL from SITE_URL / VERCEL_PROJECT_PRODUCTION_URL / localhost
 * - Copies AUTH_GITHUB_ID / AUTH_GITHUB_SECRET from process.env when present
 * - Never overwrites an existing JWT_PRIVATE_KEY / JWKS pair
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const args = process.argv.slice(2);
let deployEnvFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--env-file" && args[i + 1]) {
    deployEnvFile = args[i + 1];
    i++;
  }
}

function convexEnv(extraArgs, { input } = {}) {
  const cmdArgs = ["convex", "env", ...extraArgs];
  if (deployEnvFile) {
    cmdArgs.push("--env-file", deployEnvFile);
  }
  return spawnSync("npx", cmdArgs, {
    encoding: "utf8",
    env: process.env,
    shell: false,
    input,
  });
}

function getEnv(name) {
  const result = convexEnv(["get", name]);
  if ((result.status ?? 1) !== 0) {
    return null;
  }
  const value = (result.stdout ?? "").trimEnd();
  return value.length > 0 ? value : null;
}

function setEnv(name, value) {
  // Write the raw value to a file and use `env set NAME --from-file` so JSON /
  // PEM is stored verbatim (dotenv quoting would escape quotes into the value).
  const dir = mkdtempSync(join(tmpdir(), "convex-auth-env-"));
  const file = join(dir, `${name}.txt`);
  writeFileSync(file, value, { encoding: "utf8", mode: 0o600 });
  try {
    const result = convexEnv(["set", name, "--from-file", file]);
    if ((result.status ?? 1) !== 0) {
      const err = (result.stderr || result.stdout || "").trim();
      throw new Error(`Failed to set ${name}: ${err || `exit ${result.status}`}`);
    }
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // ignore
    }
  }
}

function resolveSiteUrl() {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    return vercelProd.startsWith("http")
      ? vercelProd.replace(/\/$/, "")
      : `https://${vercelProd.replace(/\/$/, "")}`;
  }

  // Local anonymous Convex / Next on :3000
  return "http://localhost:3000";
}

async function generateJwtPair() {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  const jwtPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
  return { jwtPrivateKey, jwks };
}

function reportMissingGitHub() {
  const id = process.env.AUTH_GITHUB_ID?.trim();
  const secret = process.env.AUTH_GITHUB_SECRET?.trim();
  if (!id || !secret) {
    console.warn(
      [
        "Convex Auth: AUTH_GITHUB_ID / AUTH_GITHUB_SECRET not provided.",
        "GitHub sign-in will stay disabled until they are set on this Convex deployment",
        "(or exported in the environment and this script is re-run).",
        "Create an OAuth App with callback:",
        "  https://<deployment>.convex.site/api/auth/callback/github",
      ].join("\n"),
    );
    return false;
  }
  return true;
}

async function main() {
  const existingJwks = getEnv("JWKS");
  const existingPrivateKey = getEnv("JWT_PRIVATE_KEY");

  if (!existingJwks || !existingPrivateKey) {
    console.log("Generating JWT_PRIVATE_KEY + JWKS for Convex Auth…");
    const { jwtPrivateKey, jwks } = await generateJwtPair();
    setEnv("JWT_PRIVATE_KEY", jwtPrivateKey);
    setEnv("JWKS", jwks);
    console.log("Set JWT_PRIVATE_KEY and JWKS");
  } else {
    console.log("JWT_PRIVATE_KEY and JWKS already present — leaving unchanged");
  }

  const siteUrl = resolveSiteUrl();
  const currentSiteUrl = getEnv("SITE_URL");
  if (currentSiteUrl !== siteUrl) {
    setEnv("SITE_URL", siteUrl);
    console.log(`Set SITE_URL=${siteUrl}`);
  } else {
    console.log(`SITE_URL already ${siteUrl}`);
  }

  if (reportMissingGitHub()) {
    const id = process.env.AUTH_GITHUB_ID.trim();
    const secret = process.env.AUTH_GITHUB_SECRET.trim();
    if (getEnv("AUTH_GITHUB_ID") !== id) {
      setEnv("AUTH_GITHUB_ID", id);
      console.log("Set AUTH_GITHUB_ID");
    } else {
      console.log("AUTH_GITHUB_ID already up to date");
    }
    if (getEnv("AUTH_GITHUB_SECRET") !== secret) {
      setEnv("AUTH_GITHUB_SECRET", secret);
      console.log("Set AUTH_GITHUB_SECRET");
    } else {
      console.log("AUTH_GITHUB_SECRET already up to date");
    }
  }

  const ready =
    Boolean(getEnv("JWT_PRIVATE_KEY")) &&
    Boolean(getEnv("JWKS")) &&
    Boolean(getEnv("SITE_URL")) &&
    Boolean(getEnv("AUTH_GITHUB_ID")) &&
    Boolean(getEnv("AUTH_GITHUB_SECRET"));

  if (ready) {
    console.log("Convex Auth env is ready for GitHub sign-in");
  } else {
    console.log(
      "Convex Auth env partially configured — GitHub provider stays disabled until AUTH_GITHUB_* are set",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
