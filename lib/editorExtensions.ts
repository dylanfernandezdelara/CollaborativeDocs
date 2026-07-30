import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

export const AgentEdit = Mark.create({
  name: "agentEdit",
  keepOnSplit: false,
  addAttributes() {
    return {
      agentId: { default: null },
      agentName: { default: null },
      task: { default: null },
      editId: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-agent-edit]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const agentName = HTMLAttributes["data-agent-name"] ?? "";
    const task = HTMLAttributes["data-task"] ?? "";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-agent-edit": HTMLAttributes["data-agent-edit"] ?? "",
        "data-agent-name": agentName,
        "data-task": task,
        class: "agent-edit",
        title: `${agentName}: ${task}`,
      }),
      0,
    ];
  },
});

export const editorExtensions = [
  StarterKit,
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  AgentEdit,
];
