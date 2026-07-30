import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type HighlightEntry = {
  text: string;
  className: string;
  title?: string;
};

export const highlightPluginKey = new PluginKey("highlights");

function findMatchesInBlock(
  node: ProseMirrorNode,
  blockPos: number,
  searchText: string,
  className: string,
  title?: string,
): Decoration[] {
  const decorations: Decoration[] = [];
  if (!searchText) return decorations;

  let blockText = "";
  const indexToPos: number[] = [];

  node.forEach((child, offset) => {
    if (!child.isText || !child.text) return;
    for (let i = 0; i < child.text.length; i++) {
      blockText += child.text[i];
      indexToPos.push(blockPos + 1 + offset + i);
    }
  });

  const searchLower = searchText.toLowerCase();
  const blockLower = blockText.toLowerCase();
  let startIdx = 0;

  while (startIdx < blockText.length) {
    const idx = blockLower.indexOf(searchLower, startIdx);
    if (idx === -1) break;

    const from = indexToPos[idx];
    const lastIdx = idx + searchText.length - 1;
    if (from === undefined || indexToPos[lastIdx] === undefined) break;

    const to = indexToPos[lastIdx]! + 1;
    decorations.push(
      Decoration.inline(from, to, { class: className, title: title ?? "" }),
    );
    startIdx = idx + searchText.length;
  }

  return decorations;
}

function buildDecorations(
  doc: ProseMirrorNode,
  highlights: HighlightEntry[],
): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    for (const highlight of highlights) {
      decorations.push(
        ...findMatchesInBlock(
          node,
          pos,
          highlight.text,
          highlight.className,
          highlight.title,
        ),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export function createHighlightExtension(
  getHighlights: () => HighlightEntry[],
) {
  return Extension.create({
    name: "highlights",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: highlightPluginKey,
          state: {
            init(_, { doc }) {
              return buildDecorations(doc, getHighlights());
            },
            apply(tr, oldSet) {
              if (!tr.docChanged && !tr.getMeta(highlightPluginKey)) {
                return oldSet.map(tr.mapping, tr.doc);
              }
              return buildDecorations(tr.doc, getHighlights());
            },
          },
          props: {
            decorations(state) {
              return highlightPluginKey.getState(state) ?? DecorationSet.empty;
            },
          },
        }),
      ];
    },
  });
}

export function refreshHighlights(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(highlightPluginKey, true));
}
