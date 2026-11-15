import { EditorView } from '@codemirror/view';
import { act } from '@testing-library/react';

function editorOf(element: HTMLElement) {
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error('The element does not belong to a Markdown editor');
  return view;
}

export function markdownText(element: HTMLElement) {
  return editorOf(element).state.doc.toString();
}

export function writeMarkdown(element: HTMLElement, text: string) {
  const view = editorOf(element);
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }));
}

export function placeMarkdownCursor(element: HTMLElement, position: number) {
  const view = editorOf(element);
  act(() => {
    view.focus();
    view.dispatch({ selection: { anchor: position } });
  });
}
