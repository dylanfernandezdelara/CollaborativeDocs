import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** One scheduled step deletes at most this many rows. */
export const PURGE_BATCH_SIZE = 100;

export const PURGE_PHASES = [
  "agents",
  "intents",
  "collaborators",
  "comments",
  "edits",
  "finalize",
] as const;

export type PurgePhase = (typeof PURGE_PHASES)[number];

type DocScopedTable = "intents" | "collaborators" | "comments" | "edits";

function nextAfter(phase: PurgePhase): PurgePhase | "done" {
  const i = PURGE_PHASES.indexOf(phase);
  if (i < 0 || i >= PURGE_PHASES.length - 1) return "done";
  return PURGE_PHASES[i + 1]!;
}

async function drainDocScoped(
  ctx: MutationCtx,
  table: DocScopedTable,
  docId: Id<"documents">,
): Promise<boolean> {
  // `intents.by_doc` is (docId, active); prefix on docId returns every intent.
  const rows = await ctx.db
    .query(table)
    .withIndex("by_doc", (q) => q.eq("docId", docId))
    .take(PURGE_BATCH_SIZE);
  for (const row of rows) {
    await ctx.db.delete(table, row._id);
  }
  return rows.length >= PURGE_BATCH_SIZE;
}

/**
 * One bounded purge step. Returns the phase to run next (`done` when the
 * document row itself has been removed). Mirrors the claim migration pattern:
 * caller schedules continuation when the returned phase is not `done`.
 */
export async function runPurgeStep(
  ctx: MutationCtx,
  docId: Id<"documents">,
  phase: PurgePhase,
): Promise<PurgePhase | "done"> {
  if (phase === "agents") {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_doc", (q) => q.eq("docId", docId))
      .first();
    if (!agent) return nextAfter(phase);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .take(PURGE_BATCH_SIZE);
    for (const row of notifications) {
      await ctx.db.delete("notifications", row._id);
    }
    if (notifications.length >= PURGE_BATCH_SIZE) {
      return "agents";
    }
    await ctx.db.delete("agents", agent._id);
    return "agents";
  }

  if (phase !== "finalize") {
    const more = await drainDocScoped(ctx, phase, docId);
    return more ? phase : nextAfter(phase);
  }

  const doc = await ctx.db.get("documents", docId);
  if (doc) {
    await ctx.runMutation(components.prosemirrorSync.lib.deleteDocument, {
      id: docId,
    });
    await ctx.db.delete("documents", docId);
  }
  return "done";
}
