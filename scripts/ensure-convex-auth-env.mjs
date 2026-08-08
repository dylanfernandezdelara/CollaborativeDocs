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
 * - Always ensures JWT_PRIVATE_KEY + JWKS (generates once if both missing; atomic write)
 * - Sets SITE_URL only when unset (never overwrites an existing Convex SITE_URL)
 * - Copies AUTH_GITHUB_ID / AUTH_GITHUB_SECRET from process.env when present
 * - Never overwrites an existing JWT_PRIVATE_KEY / JWKS pair
 * - CLI/transport/auth errors fail the process (no fail-open JWT rotation)
 */
import { spawnSync } from "node:child_process";
import {
  writeFileSync,
  unlinkSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
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

function convexEnv(extraArgs) {
  const cmdArgs = ["convex", "env", ...extraArgs];
  if (deployEnvFile) {
    cmdArgs.push("--env-file", deployEnvFile);
  }
  return spawnSync("npx", cmdArgs, {
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
}

function cliErrorText(result) {
  return (result.stderr || result.stdout || "").trim();
}

function assertOk(result, action) {
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      `Failed to ${action}: ${cliErrorText(result) || `exit ${result.status}`}`,
    );
  }
}

/** Snapshot of env var names on the deployment. Fails closed on CLI errors. */
function listEnvNames() {
  const result = convexEnv(["list", "--names-only"]);
  assertOk(result, "list environment variables");
  const stdout = result.stdout ?? "";
  const names = new Set();
  for (const line of stdout.split("\n")) {
    const name = line.trim();
    if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      names.add(name);
    }
  }
  return names;
}

/**
 * Read one env value. Distinguishes not-found (null) from CLI/transport errors
 * (throw). Convex `env get` exits 0 with a "not found" stderr when missing.
 */
function getEnv(name) {
  const result = convexEnv(["get", name]);
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      `Failed to get ${name}: ${cliErrorText(result) || `exit ${result.status}`}`,
    );
  }
  const value = (result.stdout ?? "").trimEnd();
  if (value.length > 0) {
    return value;
  }
  const err = result.stderr ?? "";
  if (/not found/i.test(err)) {
    return null;
  }
  // Empty stdout without a not-found message is unexpected — fail closed.
  throw new Error(
    `Unexpected empty result for ${name}: ${cliErrorText(result) || "no output"}`,
  );
}

function withTempFile(basename, contents, fn) {
  const dir = mkdtempSync(join(tmpdir(), "convex-auth-env-"));
  const file = join(dir, basename);
  writeFileSync(file, contents, { encoding: "utf8", mode: 0o600 });
  try {
    return fn(file);
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // ignore
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/** Escape a value for a dotenv line (used by `convex env set --from-file`). */
function formatDotenvValue(value) {
  if (!/[\s"'#\\]/.test(value) && !value.includes("\n")) {
    return value;
  }
  if (!value.includes("'") && !value.includes("\n")) {
    return `'${value}'`;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function setEnv(name, value) {
  // Single-var form: raw file contents become the value (needed for SITE_URL —
  // multi-var --from-file skips Convex-managed names including SITE_URL).
  withTempFile(`${name}.txt`, value, (file) => {
    const result = convexEnv(["set", name, "--from-file", file]);
    assertOk(result, `set ${name}`);
  });
}

/** Atomically set multiple vars via one `env set --from-file` (dotenv). */
function setEnvMulti(entries, { force = false } = {}) {
  const body = Object.entries(entries)
    .map(([name, value]) => `${name}=${formatDotenvValue(value)}`)
    .join("\n");
  withTempFile("vars.env", `${body}\n`, (file) => {
    const args = ["set", "--from-file", file];
    if (force) args.push("--force");
    const result = convexEnv(args);
    assertOk(result, `set ${Object.keys(entries).join(", ")}`);
  });
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
  const present = listEnvNames();
  const hasJwks = present.has("JWKS");
  const hasPrivateKey = present.has("JWT_PRIVATE_KEY");

  if (!hasJwks && !hasPrivateKey) {
    console.log("Generating JWT_PRIVATE_KEY + JWKS for Convex Auth…");
    const { jwtPrivateKey, jwks } = await generateJwtPair();
    setEnvMulti(
      {
        JWT_PRIVATE_KEY: jwtPrivateKey,
        JWKS: jwks,
      },
      { force: false },
    );
    console.log("Set JWT_PRIVATE_KEY and JWKS");
  } else if (hasJwks && hasPrivateKey) {
    console.log("JWT_PRIVATE_KEY and JWKS already present — leaving unchanged");
  } else {
    throw new Error(
      "Convex Auth JWT env is incomplete (only one of JWT_PRIVATE_KEY / JWKS is set). " +
        "Fix manually — refusing to rotate a partial pair.",
    );
  }

  // Never clobber an existing SITE_URL (Vercel inference / localhost must not win).
  if (!present.has("SITE_URL")) {
    const siteUrl = resolveSiteUrl();
    setEnv("SITE_URL", siteUrl);
    console.log(`Set SITE_URL=${siteUrl}`);
  } else {
    console.log("SITE_URL already set — leaving unchanged");
  }

  if (reportMissingGitHub()) {
    const id = process.env.AUTH_GITHUB_ID.trim();
    const secret = process.env.AUTH_GITHUB_SECRET.trim();
    if (!present.has("AUTH_GITHUB_ID") || getEnv("AUTH_GITHUB_ID") !== id) {
      setEnv("AUTH_GITHUB_ID", id);
      console.log("Set AUTH_GITHUB_ID");
    } else {
      console.log("AUTH_GITHUB_ID already up to date");
    }
    if (
      !present.has("AUTH_GITHUB_SECRET") ||
      getEnv("AUTH_GITHUB_SECRET") !== secret
    ) {
      setEnv("AUTH_GITHUB_SECRET", secret);
      console.log("Set AUTH_GITHUB_SECRET");
    } else {
      console.log("AUTH_GITHUB_SECRET already up to date");
    }
  }

  // Fresh presence check for the ready summary (list again; fail closed).
  const finalPresent = listEnvNames();
  const ready =
    finalPresent.has("JWT_PRIVATE_KEY") &&
    finalPresent.has("JWKS") &&
    finalPresent.has("SITE_URL") &&
    finalPresent.has("AUTH_GITHUB_ID") &&
    finalPresent.has("AUTH_GITHUB_SECRET");

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
