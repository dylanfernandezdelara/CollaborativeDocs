import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  addCommentForAgent,
  applyWriteForAgent,
  declareIntentForAgent,
  getDocumentForAgent,
  toolErrorResult,
  toolTextResult,
  waitForNotificationsForAgent,
} from "../../lib/convex-agent";

export const maxDuration = 60;

function createHandler(token: string) {
  return createMcpHandler(
    (server) => {
      server.registerTool(
        "get_document",
        {
          title: "Get Document",
          description:
            "Read the full document. Returns numbered blocks [index] in markdown, the current version, active collaborator intents, open comments, and a digest of changes since your last call. ALWAYS call this before writing.",
          inputSchema: z.object({}),
        },
        async () => {
          const result = await getDocumentForAgent(token);
          if (!result.ok) {
            return toolErrorResult(result.error);
          }
          return toolTextResult(result.value);
        },
      );

      server.registerTool(
        "write_document",
        {
          title: "Write Document",
          description:
            "Write to the document. action=replace_block replaces block block_index (REQUIRED: pass expected_text = the exact current plain text of that block from your latest get_document; if the block changed since you read it, the write is REJECTED and you must re-read and adapt). insert_after_block inserts new blocks after block_index. append adds to the end. content_markdown supports paragraphs, headings, lists, and GFM tables. Always pass task = the instruction you were given, verbatim.",
          inputSchema: z.object({
            action: z.enum(["replace_block", "insert_after_block", "append"]),
            block_index: z.number().optional(),
            expected_text: z.string().optional(),
            content_markdown: z.string(),
            task: z.string(),
          }),
        },
        async ({ action, block_index, expected_text, content_markdown, task }) => {
          const result = await applyWriteForAgent(token, {
            action,
            blockIndex: block_index,
            expectedText: expected_text,
            contentMarkdown: content_markdown,
            task,
          });
          if (!result.ok) {
            return toolErrorResult(result.error);
          }
          if (result.value.rejected) {
            return {
              content: [{ type: "text" as const, text: result.value.text }],
            };
          }
          return toolTextResult(result.value.value);
        },
      );

      server.registerTool(
        "declare_intent",
        {
          title: "Declare Intent",
          description:
            "Declare what you are about to work on BEFORE writing, so humans see a live indicator on that text. anchor_text = an exact short quote from the block you will edit. task = what you're doing.",
          inputSchema: z.object({
            task: z.string(),
            anchor_text: z.string(),
          }),
        },
        async ({ task, anchor_text }) => {
          const result = await declareIntentForAgent(token, {
            task,
            anchorText: anchor_text,
          });
          if (!result.ok) {
            return toolErrorResult(result.error);
          }
          return toolTextResult(result.value);
        },
      );

      server.registerTool(
        "add_comment",
        {
          title: "Add Comment",
          description:
            "Add a comment anchored to specific text in the document, or reply to an existing comment (pass parent_comment_id). anchor_text must be an exact quote from the document.",
          inputSchema: z.object({
            anchor_text: z.string().optional(),
            text: z.string(),
            parent_comment_id: z.string().optional(),
          }),
        },
        async ({ anchor_text, text, parent_comment_id }) => {
          const result = await addCommentForAgent(token, {
            anchorText: anchor_text,
            text,
            parentCommentId: parent_comment_id,
          });
          if (!result.ok) {
            return toolErrorResult(result.error);
          }
          return toolTextResult(result.value);
        },
      );

      server.registerTool(
        "wait_for_notifications",
        {
          title: "Wait For Notifications",
          description:
            "Wait for notifications (e.g. a human sends you a comment to address). Blocks up to 45 seconds. If it returns status nothing_yet, CALL IT AGAIN immediately to keep listening — loop until you receive a notification, then act on it, then resume waiting.",
          inputSchema: z.object({}),
        },
        async () => {
          const result = await waitForNotificationsForAgent(token);
          if (!result.ok) {
            return toolErrorResult(result.error);
          }
          return toolTextResult(result.value);
        },
      );
    },
    {
      serverInfo: {
        name: "collabdocs",
        version: "1.0.0",
      },
    },
  );
}

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  return createHandler(token)(request);
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  return createHandler(token)(request);
}
