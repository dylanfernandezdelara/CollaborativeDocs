import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_DISPLAY_NAME_LENGTH } from "../../lib/displayName";

export const MAX_EDITOR_NAME_LENGTH = MAX_DISPLAY_NAME_LENGTH;

/** Trim and bound editor labels before writing denormalized last-edit fields. */
export function normalizeEditorName(name: string): string {
  return name.trim().slice(0, MAX_EDITOR_NAME_LENGTH);
}

/** Single write path for document last-edit used by humans (`touch`) and agents. */
export async function recordLastEdit(
  ctx: MutationCtx,
  docId: Id<"documents">,
  editor: { name: string; isAgent: boolean },
): Promise<void> {
  const name = normalizeEditorName(editor.name);
  if (!name) return;
  await ctx.db.patch("documents", docId, {
    lastEditedAt: Date.now(),
    lastEditorName: name,
    lastEditorIsAgent: editor.isAgent,
  });
}
