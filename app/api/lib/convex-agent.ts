import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const INVALID_TOKEN = "Invalid or revoked token";

let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }
  if (!convexClient) {
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

function isInvalidTokenError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Invalid or revoked agent token") ||
      error.message.includes("Invalid or revoked token"))
  );
}

export function markdownBlockToPlainText(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("#")) {
    return trimmed.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
  }

  if (trimmed.startsWith("|")) {
    return trimmed
      .split("\n")
      .filter((line) => !/^\|[-| :]+\|$/.test(line.trim()))
      .flatMap((line) =>
        line
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean),
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return trimmed
    .split("\n")
    .map((line) => line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, ""))
    .join(" ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toolTextResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function toolErrorResult(message: string) {
  return toolTextResult(message);
}

export async function withValidToken<T>(
  token: string,
  fn: (client: ConvexHttpClient) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const client = getConvexClient();
  try {
    const value = await fn(client);
    return { ok: true, value };
  } catch (error) {
    if (isInvalidTokenError(error)) {
      return { ok: false, error: INVALID_TOKEN };
    }
    throw error;
  }
}

export async function resolveDocId(
  client: ConvexHttpClient,
  token: string,
  title: string,
): Promise<Id<"documents">> {
  const pending = await client.query(api.notifications.pending, { token });
  if (pending?.docId) {
    return pending.docId;
  }

  const documents = await client.query(api.documents.list, {});
  const matches = documents.filter((doc) => doc.title === title);
  if (matches.length === 1) {
    return matches[0]!._id;
  }

  throw new Error(`Unable to resolve document id for title "${title}"`);
}

export async function getDocumentForAgent(token: string) {
  return withValidToken(token, async (client) => {
    const doc = await client.mutation(api.agentDoc.getDoc, { token });
    const blocks = (doc.blocks as Array<{ index: number; markdown: string }>).map(
      (block) => ({
        ...block,
        plainText: markdownBlockToPlainText(block.markdown),
      }),
    );
    return { ...doc, blocks };
  });
}

export async function applyWriteForAgent(
  token: string,
  args: {
    action: "replace_block" | "insert_after_block" | "append";
    blockIndex?: number;
    expectedText?: string;
    contentMarkdown: string;
    task: string;
  },
) {
  return withValidToken(token, async (client) => {
    const result = await client.mutation(api.agentDoc.applyWrite, {
      token,
      action: args.action,
      blockIndex: args.blockIndex,
      expectedText: args.expectedText,
      contentMarkdown: args.contentMarkdown,
      task: args.task,
    });

    if (result && typeof result === "object" && "ok" in result && result.ok === false) {
      const rejectionPrefix =
        "WRITE REJECTED — the document changed while you were working. Read the current state below, then re-read the document and retry.";
      return {
        rejected: true as const,
        text: `${rejectionPrefix}\n${JSON.stringify(result, null, 2)}`,
      };
    }

    return { rejected: false as const, value: result };
  });
}

export async function declareIntentForAgent(
  token: string,
  args: { task: string; anchorText: string },
) {
  return withValidToken(token, async (client) => {
    const intentId = await client.mutation(api.intents.declare, {
      token,
      task: args.task,
      anchorText: args.anchorText,
    });
    return { ok: true, intentId };
  });
}

export async function addCommentForAgent(
  token: string,
  args: {
    anchorText?: string;
    text: string;
    parentCommentId?: string;
  },
) {
  return withValidToken(token, async (client) => {
    const doc = await client.mutation(api.agentDoc.getDoc, { token });
    const docId = await resolveDocId(client, token, doc.title as string);

    const commentId = await client.mutation(api.comments.add, {
      docId,
      authorName: "Agent",
      anchorText: args.anchorText,
      text: args.text,
      parentId: args.parentCommentId as Id<"comments"> | undefined,
      token,
    });

    return { ok: true, commentId };
  });
}

export async function waitForNotificationsForAgent(token: string) {
  const started = Date.now();
  const timeoutMs = 45_000;
  const pollMs = 1500;

  while (Date.now() - started < timeoutMs) {
    const result = await withValidToken(token, async (client) => {
      const notification = await client.query(api.notifications.pending, { token });
      if (!notification) {
        return null;
      }

      await client.mutation(api.notifications.consume, {
        notificationId: notification._id,
      });

      return {
        status: "notification" as const,
        kind: notification.kind,
        payload: JSON.parse(notification.payload) as unknown,
      };
    });

    if (!result.ok) {
      return result;
    }

    if (result.value) {
      return { ok: true as const, value: result.value };
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return {
    ok: true as const,
    value: {
      status: "nothing_yet" as const,
      instruction: "Call wait_for_notifications again now.",
    },
  };
}
