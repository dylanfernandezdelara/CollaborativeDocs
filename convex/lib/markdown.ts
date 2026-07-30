import { marked, type Token } from "marked";

type PmNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

function textNode(text: string, marks?: PmNode["marks"]): PmNode {
  const node: PmNode = { type: "text", text };
  if (marks && marks.length > 0) {
    node.marks = marks;
  }
  return node;
}

function paragraphNode(content: PmNode[]): PmNode {
  return { type: "paragraph", content };
}

function inlineTokensToPmContent(tokens: Token[] | undefined): PmNode[] {
  if (!tokens || tokens.length === 0) {
    return [];
  }

  const content: PmNode[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text":
      case "escape":
        if (token.text) {
          content.push(textNode(token.text));
        }
        break;
      case "strong":
        content.push(
          ...inlineTokensToPmContent(
            token.tokens ?? [{ type: "text", text: token.text, raw: token.text }],
          ).map((node) => {
            if (node.type !== "text") {
              return node;
            }
            return textNode(node.text ?? "", [
              ...(node.marks ?? []),
              { type: "bold" },
            ]);
          }),
        );
        break;
      case "em":
        content.push(
          ...inlineTokensToPmContent(
            token.tokens ?? [{ type: "text", text: token.text, raw: token.text }],
          ).map((node) => {
            if (node.type !== "text") {
              return node;
            }
            return textNode(node.text ?? "", [
              ...(node.marks ?? []),
              { type: "italic" },
            ]);
          }),
        );
        break;
      case "codespan":
        content.push(
          textNode(token.text, [{ type: "code" }]),
        );
        break;
      case "link":
        content.push(
          ...inlineTokensToPmContent(
            token.tokens ?? [{ type: "text", text: token.text, raw: token.text }],
          ),
        );
        break;
      case "br":
        content.push(textNode("\n"));
        break;
      default:
        if ("text" in token && typeof token.text === "string" && token.text) {
          content.push(textNode(token.text));
        } else if ("raw" in token && typeof token.raw === "string" && token.raw) {
          content.push(textNode(token.raw));
        }
        break;
    }
  }

  return content;
}

function listItemToParagraph(item: Token & { type: "list_item" }): PmNode {
  const paragraphToken = item.tokens?.find((t) => t.type === "paragraph") as
    | (Token & { type: "paragraph" })
    | undefined;
  const content = paragraphToken
    ? inlineTokensToPmContent(paragraphToken.tokens)
    : inlineTokensToPmContent(
        item.tokens?.filter((t) => t.type !== "list") as Token[] | undefined,
      );
  return paragraphNode(content.length > 0 ? content : []);
}

function tableTokenToPm(
  token: Token & {
    type: "table";
    header: Array<{ text: string; tokens: Token[] }>;
    rows: Array<Array<{ text: string; tokens: Token[] }>>;
  },
): PmNode {
  const rows: PmNode[] = [];

  rows.push({
    type: "tableRow",
    content: token.header.map((cell) => ({
      type: "tableHeader",
      content: [
        paragraphNode(
          inlineTokensToPmContent(cell.tokens).length > 0
            ? inlineTokensToPmContent(cell.tokens)
            : cell.text
              ? [textNode(cell.text)]
              : [],
        ),
      ],
    })),
  });

  for (const row of token.rows) {
    rows.push({
      type: "tableRow",
      content: row.map((cell) => ({
        type: "tableCell",
        content: [
          paragraphNode(
            inlineTokensToPmContent(cell.tokens).length > 0
              ? inlineTokensToPmContent(cell.tokens)
              : cell.text
                ? [textNode(cell.text)]
                : [],
          ),
        ],
      })),
    });
  }

  return { type: "table", content: rows };
}

export function markdownToPmNodes(md: string): PmNode[] {
  const tokens = marked.lexer(md);
  const nodes: PmNode[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const level = Math.min(Math.max(token.depth, 1), 3);
        nodes.push({
          type: "heading",
          attrs: { level },
          content: inlineTokensToPmContent(
            token.tokens ?? [{ type: "text", text: token.text, raw: token.text }],
          ),
        });
        break;
      }
      case "paragraph":
        nodes.push({
          type: "paragraph",
          content: inlineTokensToPmContent(
            token.tokens ?? [{ type: "text", text: token.text, raw: token.text }],
          ),
        });
        break;
      case "list":
        nodes.push({
          type: token.ordered ? "orderedList" : "bulletList",
          content: token.items.map((item: Token & { type: "list_item" }) => ({
            type: "listItem",
            content: [listItemToParagraph(item)],
          })),
        });
        break;
      case "code":
        nodes.push({
          type: "codeBlock",
          content: token.text ? [textNode(token.text)] : [],
        });
        break;
      case "table":
        nodes.push(
          tableTokenToPm(
            token as Token & {
              type: "table";
              header: Array<{ text: string; tokens: Token[] }>;
              rows: Array<Array<{ text: string; tokens: Token[] }>>;
            },
          ),
        );
        break;
      case "space":
        break;
      default:
        nodes.push(
          paragraphNode([
            textNode(
              ("text" in token && typeof token.text === "string"
                ? token.text
                : token.raw) ?? "",
            ),
          ]),
        );
        break;
    }
  }

  return nodes;
}

function serializeInlineContent(content: PmNode[] | undefined): string {
  if (!content) {
    return "";
  }

  return content
    .map((node) => {
      if (node.type !== "text") {
        return "";
      }
      let text = node.text ?? "";
      const marks = (node.marks ?? []).filter((m) => m.type !== "agentEdit");
      for (const mark of marks) {
        if (mark.type === "bold") {
          text = `**${text}**`;
        } else if (mark.type === "italic") {
          text = `*${text}*`;
        } else if (mark.type === "code") {
          text = `\`${text}\``;
        }
      }
      return text;
    })
    .join("");
}

function serializeListItems(items: PmNode[], ordered: boolean): string {
  return items
    .map((item, index) => {
      const paragraph = item.content?.find((c) => c.type === "paragraph");
      const prefix = ordered ? `${index + 1}. ` : "- ";
      return `${prefix}${serializeInlineContent(paragraph?.content)}`;
    })
    .join("\n");
}

export function pmNodeToMarkdown(node: PmNode): string {
  switch (node.type) {
    case "heading": {
      const level = (node.attrs?.level as number | undefined) ?? 1;
      const hashes = "#".repeat(Math.min(Math.max(level, 1), 3));
      return `${hashes} ${serializeInlineContent(node.content)}`;
    }
    case "paragraph":
      return serializeInlineContent(node.content);
    case "bulletList":
      return serializeListItems(node.content ?? [], false);
    case "orderedList":
      return serializeListItems(node.content ?? [], true);
    case "codeBlock":
      return `\`\`\`\n${node.content?.map((c) => c.text ?? "").join("") ?? ""}\n\`\`\``;
    case "table": {
      const rows = node.content ?? [];
      if (rows.length === 0) {
        return "";
      }
      const lines: string[] = [];
      rows.forEach((row, rowIndex) => {
        const cells = (row.content ?? []).map((cell) => {
          const paragraph = cell.content?.find((c) => c.type === "paragraph");
          return serializeInlineContent(paragraph?.content);
        });
        lines.push(`|${cells.join("|")}|`);
        if (rowIndex === 0) {
          lines.push(`|${cells.map(() => "---").join("|")}|`);
        }
      });
      return lines.join("\n");
    }
    default:
      return serializeInlineContent(node.content);
  }
}

export function pmNodeToPlainText(node: PmNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }
  if (!node.content) {
    return "";
  }
  return node.content.map((child) => pmNodeToPlainText(child)).join("");
}

export function pmDocToBlocks(
  doc: PmNode,
): Array<{ index: number; markdown: string; plainText: string }> {
  const blocks = doc.content ?? [];
  return blocks.map((node, index) => ({
    index,
    markdown: pmNodeToMarkdown(node),
    plainText: pmNodeToPlainText(node),
  }));
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
