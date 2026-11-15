import { indentLess, indentMore, insertTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { keymap, type Command } from '@codemirror/view';

const listItemLine = /^\s*(?:[-*+]|\d+[.)])\s/;

const indentListItemOrInsertTab: Command = (view) => {
  const { doc, selection } = view.state;
  const isInListItem = selection.ranges.some((range) =>
    listItemLine.test(doc.lineAt(range.head).text),
  );
  return isInListItem ? indentMore(view) : insertTab(view);
};

export const markdownIndentation = [
  indentUnit.of('\t'),
  EditorState.tabSize.of(8),
  keymap.of([{ key: 'Tab', run: indentListItemOrInsertTab, shift: indentLess }]),
];
