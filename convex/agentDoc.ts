import { getSchema } from "@tiptap/core";
import { Transform } from "@tiptap/pm/transform";
import { Fragment } from "@tiptap/pm/model";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getAgentByToken } from "./lib/agentAuth";
import { editorExtensions } from "../lib/editorExtensions";
import {
  markdownToPmNodes,
  normalize,
  pmDocToBlocks,
  pmNodeToMarkdown,
  pmNodeToPlainText,
} from "./lib/markdown";
import { prosemirrorSync } from "./prosemirror";

const schema = getSchema(editorExtensions);
const fetchProsemirrorDoc = prosemirrorSync.getDoc.bind(prosemirrorSync);
const transformProsemirrorDoc = prosemirrorSync.transform.bind(prosemirrorSync);

type PmJson = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmJson[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

function addAgentEditMark(node: PmJson, attrs: Record<string, string | null>): PmJson {
  if (node.type === "text") {
    return {
      ...node,
      marks: [...(node.marks ?? []), { type: "agentEdit", attrs }],
    };
  }
  if (node.content) {
    return {
      ...node,
      content: node.content.map((child) => addAgentEditMark(child, attrs)),
    };
  }
  return node;
}

function getTopLevelBlock(doc: ReturnType<typeof schema.nodeFromJSON>, blockIndex: number) {
  if (blockIndex < 0 || blockIndex >= doc.content.childCount) {
    return null;
  }
  return doc.content.child(blockIndex);
}

function getBlockRange(
  doc: ReturnType<typeof schema.nodeFromJSON>,
  blockIndex: number,
): { start: number; end: number; node: ReturnType<typeof doc.content.child> } | null {
  let index = 0;
  let result: { start: number; end: number; node: ReturnType<typeof doc.content.child> } | null =
    null;

  doc.forEach((node, offset) => {
    if (index === blockIndex) {
      result = { start: offset, end: offset + node.nodeSize, node };
    }
    index += 1;
  });

  return result;
}

async function buildDigest(
  ctx: MutationCtx,
  agent: Doc<"agents">,
  currentVersion: number,
): Promise<{ docVersion: number; notes: string[] }> {
  const notes: string[] = [];

  if (currentVersion > agent.lastSeenVersion) {
    notes.push(
      `Document version advanced from ${agent.lastSeenVersion} to ${currentVersion} since your last call (edits by humans and/or other agents occurred)`,
    );
  }

  const edits = await ctx.db
    .query("edits")
    .withIndex("by_doc", (q) => q.eq("docId", agent.docId))
    .collect();

  for (const edit of edits) {
    if (edit.createdAt > agent.lastDigestAt) {
      notes.push(`${edit.agentName} wrote (${edit.task}): ${edit.summary}`);
    }
  }

  const comments = await ctx.db
    .query("comments")
    .withIndex("by_doc", (q) => q.eq("docId", agent.docId))
    .collect();

  for (const comment of comments) {
    if (comment.createdAt > agent.lastDigestAt) {
      const anchor = comment.anchorText ?? "";
      notes.push(`${comment.authorName} commented on "${anchor}": ${comment.text}`);
    }
  }

  const intents = await ctx.db
    .query("intents")
    .withIndex("by_doc", (q) => q.eq("docId", agent.docId).eq("active", true))
    .collect();

  for (const intent of intents) {
    if (intent.agentId === agent._id) {
      continue;
    }
    const otherAgent = await ctx.db.get("agents", intent.agentId);
    if (!otherAgent) {
      continue;
    }
    notes.push(
      `${otherAgent.name} is currently working on: ${intent.task} (near: ${intent.anchorText})`,
    );
  }

  await ctx.db.patch("agents", agent._id, {
    lastDigestAt: Date.now(),
    lastSeenAt: Date.now(),
    lastSeenVersion: currentVersion,
  });

  return { docVersion: currentVersion, notes };
}

export const getDoc = mutation({
  args: { token: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const agent = await getAgentByToken(ctx, args.token);
    if (!agent) {
      throw new Error("Invalid or revoked agent token");
    }

    const document = await ctx.db.get("documents", agent.docId);
    if (!document) {
      throw new Error("Document not found");
    }

    const docIdStr = agent.docId as string;
    const { doc, version } = await fetchProsemirrorDoc(ctx, docIdStr, schema);
    const blocks = pmDocToBlocks(doc.toJSON() as PmJson).map(({ index, markdown }) => ({
      index,
      markdown,
    }));

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_doc", (q) => q.eq("docId", agent.docId))
      .collect();

    const activeIntents = await ctx.db
      .query("intents")
      .withIndex("by_doc", (q) => q.eq("docId", agent.docId).eq("active", true))
      .collect();

    const intentResults = [];
    for (const intent of activeIntents) {
      const intentAgent = await ctx.db.get("agents", intent.agentId);
      if (!intentAgent) {
        continue;
      }
      intentResults.push({
        agentId: intent.agentId,
        agentName: intentAgent.name,
        task: intent.task,
        anchorText: intent.anchorText,
      });
    }

    const digestResult = await buildDigest(ctx, agent, version);

    return {
      ok: true,
      version,
      title: document.title,
      blocks,
      comments: comments
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(({ _id, authorName, anchorText, text, parentId, resolved }) => ({
          id: _id,
          authorName,
          anchorText,
          text,
          parentId,
          resolved,
        })),
      activeIntents: intentResults,
      digest: digestResult.notes,
    };
  },
});

export const applyWrite = mutation({
  args: {
    token: v.string(),
    action: v.union(
      v.literal("replace_block"),
      v.literal("insert_after_block"),
      v.literal("append"),
    ),
    blockIndex: v.optional(v.number()),
    expectedText: v.optional(v.string()),
    contentMarkdown: v.string(),
    task: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const agent = await getAgentByToken(ctx, args.token);
    if (!agent) {
      throw new Error("Invalid or revoked agent token");
    }

    const docIdStr = agent.docId as string;
    const readVersion = (await fetchProsemirrorDoc(ctx, docIdStr, schema)).version;
    let { doc, version } = await fetchProsemirrorDoc(ctx, docIdStr, schema);

    const makeStaleResponse = async (blockIndex: number) => {
      const block = getTopLevelBlock(doc, blockIndex);
      const blockJson = block?.toJSON() as PmJson | undefined;
      const digestResult = await buildDigest(ctx, agent, version);
      return {
        ok: false as const,
        reason: "stale" as const,
        currentBlockMarkdown: blockJson ? pmNodeToMarkdown(blockJson) : "",
        currentBlockText: blockJson ? pmNodeToPlainText(blockJson) : "",
        digest: digestResult.notes,
        instruction:
          "The document changed since you read it. Re-read with get_document, then retry against the current content.",
      };
    };

    const makeBlockNotFoundResponse = async () => {
      const digestResult = await buildDigest(ctx, agent, version);
      return {
        ok: false as const,
        reason: "block_not_found" as const,
        blockCount: doc.content.childCount,
        digest: digestResult.notes,
      };
    };

    const editId = crypto.randomUUID();
    const agentEditAttrs = {
      agentId: agent._id as string,
      agentName: agent.name,
      task: args.task,
      editId,
    };

    const markdownNodes = markdownToPmNodes(args.contentMarkdown).map((node) =>
      addAgentEditMark(node, agentEditAttrs),
    );
    const pmNodes = markdownNodes.map((node) => schema.nodeFromJSON(node));
    const fragment = Fragment.from(pmNodes);

    if (args.action === "replace_block" || args.action === "insert_after_block") {
      if (args.blockIndex === undefined) {
        throw new Error("blockIndex is required for this action");
      }

      const block = getTopLevelBlock(doc, args.blockIndex);
      if (!block) {
        return await makeBlockNotFoundResponse();
      }

      const blockJson = block.toJSON() as PmJson;
      if (
        args.expectedText !== undefined &&
        normalize(args.expectedText) !== normalize(pmNodeToPlainText(blockJson))
      ) {
        return await makeStaleResponse(args.blockIndex);
      }
    }

    let abortedStale = false;
    const initialReadVersion = readVersion;

    await transformProsemirrorDoc(ctx, docIdStr, schema, (currentDoc, currentVersion) => {
      if (
        args.expectedText !== undefined &&
        (args.action === "replace_block" || args.action === "insert_after_block") &&
        currentVersion > initialReadVersion
      ) {
        const blockIndex = args.blockIndex!;
        const freshBlock = getTopLevelBlock(currentDoc, blockIndex);
        if (!freshBlock) {
          return null;
        }
        const freshJson = freshBlock.toJSON() as PmJson;
        if (normalize(args.expectedText!) !== normalize(pmNodeToPlainText(freshJson))) {
          abortedStale = true;
          return null;
        }
      }

      const tr = new Transform(currentDoc);

      if (args.action === "append") {
        tr.insert(currentDoc.content.size, fragment);
        return tr;
      }

      const blockIndex = args.blockIndex!;
      const range = getBlockRange(currentDoc, blockIndex);
      if (!range) {
        return null;
      }

      if (args.action === "replace_block") {
        tr.replaceWith(range.start, range.end, fragment);
      } else {
        tr.insert(range.end, fragment);
      }

      return tr;
    });

    if (abortedStale && args.blockIndex !== undefined) {
      ({ doc, version } = await fetchProsemirrorDoc(ctx, docIdStr, schema));
      return await makeStaleResponse(args.blockIndex);
    }

    if (
      (args.action === "replace_block" || args.action === "insert_after_block") &&
      args.blockIndex !== undefined &&
      !getTopLevelBlock(doc, args.blockIndex)
    ) {
      return await makeBlockNotFoundResponse();
    }

    const plainSummarySource = args.contentMarkdown.replace(/\s+/g, " ").trim();
    const summary = plainSummarySource.slice(0, 120);

    await ctx.db.insert("edits", {
      docId: agent.docId,
      agentId: agent._id,
      agentName: agent.name,
      task: args.task,
      summary,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.intents.clearForAgentInternal, {
      agentId: agent._id,
    });

    const { version: newVersion } = await fetchProsemirrorDoc(
      ctx,
      docIdStr,
      schema,
    );

    await ctx.db.patch("agents", agent._id, {
      lastSeenVersion: newVersion,
      lastSeenAt: Date.now(),
    });

    const refreshedAgent = (await ctx.db.get("agents", agent._id))!;
    const digestResult = await buildDigest(ctx, refreshedAgent, newVersion);

    return {
      ok: true,
      newVersion,
      digest: digestResult.notes,
    };
  },
});
