import { syntaxTree } from '@codemirror/language';
import { StateEffect, StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { GFM, parser as commonMarkParser } from '@lezer/markdown';

type SyntaxNode = ReturnType<typeof syntaxTree>['topNode'];

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const bullet = document.createElement('span');
    bullet.className = 'cm-md-bullet';
    bullet.textContent = '•';
    return bullet;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const rule = document.createElement('span');
    rule.className = 'cm-md-rule';
    return rule;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly alternativeText: string,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return other.source === this.source && other.alternativeText === this.alternativeText;
  }

  toDOM() {
    const image = document.createElement('img');
    image.className = 'cm-md-image';
    image.src = this.source;
    image.alt = this.alternativeText;
    return image;
  }
}

class TaskWidget extends WidgetType {
  constructor(private readonly isDone: boolean) {
    super();
  }

  eq(other: TaskWidget) {
    return other.isDone === this.isDone;
  }

  toDOM(view: EditorView) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'cm-md-task';
    box.checked = this.isDone;
    box.setAttribute('aria-label', this.isDone ? 'Marcar como pendiente' : 'Marcar como hecha');
    box.addEventListener('mousedown', (event) => event.preventDefault());
    box.addEventListener('click', (event) => {
      event.preventDefault();
      const from = view.posAtDOM(box);
      const isMarker = /^\[[ xX]\]$/.test(view.state.sliceDoc(from, from + 3));
      if (view.state.readOnly || !isMarker) return;
      view.dispatch({ changes: { from, to: from + 3, insert: this.isDone ? '[ ]' : '[x]' } });
    });
    return box;
  }
}

const cellParser = commonMarkParser.configure(GFM);
const cellElements: Record<string, string> = {
  StrongEmphasis: 'strong',
  Emphasis: 'em',
  InlineCode: 'code',
  Strikethrough: 'del',
  Link: 'span',
};

function appendFormatted(target: HTMLElement, node: SyntaxNode, text: string) {
  let position = node.from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > position) target.append(text.slice(position, child.from));
    position = child.to;
    if (child.name.endsWith('Mark') || child.name === 'LinkTitle') continue;
    if (child.name === 'URL' && node.name === 'Link') continue;
    if (child.name === 'Escape') {
      target.append(text.slice(child.from + 1, child.to));
    } else if (child.name in cellElements) {
      const element = document.createElement(cellElements[child.name]);
      if (child.name === 'Link') element.className = 'cm-md-link';
      appendFormatted(element, child, text);
      target.append(element);
    } else if (child.firstChild) {
      appendFormatted(target, child, text);
    } else {
      target.append(text.slice(child.from, child.to));
    }
  }
  if (node.to > position) target.append(text.slice(position, node.to));
}

type TableCell = { text: string; offset: number };

function tableCells(line: string, lineOffset: number) {
  const cells: TableCell[] = [];
  let start = 0;
  for (let index = 0; index <= line.length; index += 1) {
    const isDivider = line[index] === '|' && line[index - 1] !== '\\';
    if (index < line.length && !isDivider) continue;
    const raw = line.slice(start, index);
    const text = raw.trim();
    cells.push({ text, offset: lineOffset + start + (text ? raw.indexOf(text) : raw.length) });
    start = index + 1;
  }
  if (cells[0]?.text === '') cells.shift();
  if (cells.at(-1)?.text === '') cells.pop();
  return cells;
}

function columnAlignment(delimiter: string) {
  if (delimiter.startsWith(':') && delimiter.endsWith(':')) return 'center';
  if (delimiter.endsWith(':')) return 'right';
  return delimiter.startsWith(':') ? 'left' : '';
}

class TableWidget extends WidgetType {
  constructor(private readonly source: string) {
    super();
  }

  eq(other: TableWidget) {
    return other.source === this.source;
  }

  toDOM(view: EditorView) {
    const lines = this.source.split('\n');
    const offsets = lines.map((_, index) =>
      lines.slice(0, index).reduce((total, line) => total + line.length + 1, 0),
    );
    const rows = lines.map((line, index) => tableCells(line, offsets[index]));
    const alignments = rows[1].map((cell) => columnAlignment(cell.text));
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-md-table-wrapper';
    const table = wrapper.appendChild(document.createElement('table'));
    table.className = 'cm-md-table';
    const sections = [table.createTHead(), table.createTBody()];
    rows.forEach((cells, rowIndex) => {
      if (rowIndex === 1) return;
      const row = sections[rowIndex === 0 ? 0 : 1].insertRow();
      rows[0].forEach((_, column) => {
        const cell = row.appendChild(document.createElement(rowIndex === 0 ? 'th' : 'td'));
        const { text, offset } = cells[column] ?? { text: '', offset: offsets[rowIndex] };
        cell.dataset.offset = String(offset);
        cell.style.textAlign = alignments[column] ?? '';
        appendFormatted(cell, cellParser.parse(text).topNode, text);
      });
    });
    wrapper.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-offset]');
      view.focus();
      view.dispatch({
        selection: { anchor: view.posAtDOM(wrapper) + Number(cell?.dataset.offset ?? 0) },
      });
    });
    return wrapper;
  }
}

const hiddenSyntax = Decoration.replace({});
const visibleSyntax = Decoration.mark({ class: 'cm-md-syntax' });
const bullet = Decoration.replace({ widget: new BulletWidget() });
const rule = Decoration.replace({ widget: new RuleWidget() });
const inlineStyles: Record<string, Decoration> = {
  Emphasis: Decoration.mark({ class: 'cm-md-emphasis' }),
  StrongEmphasis: Decoration.mark({ class: 'cm-md-strong' }),
  InlineCode: Decoration.mark({ class: 'cm-md-code' }),
  Strikethrough: Decoration.mark({ class: 'cm-md-strikethrough' }),
};
const linkText = Decoration.mark({ class: 'cm-md-link' });
const orderedListMark = Decoration.mark({ class: 'cm-md-list-number' });
const codeBlockNames = new Set(['FencedCode', 'CodeBlock']);
const inlineMarkNames = new Set(['EmphasisMark', 'CodeMark', 'LinkMark', 'StrikethroughMark']);
const inlineMarkParents = new Set([
  'Emphasis',
  'StrongEmphasis',
  'InlineCode',
  'Strikethrough',
  'Autolink',
]);
const urlOwners = new Set(['Link', 'LinkReference']);

function displayableImageSource(source: string) {
  return /^(https?:\/\/|\/(?!\/)|\.{1,2}\/)/i.test(source);
}

export function livePreviewDecorations(state: EditorState, revealsSyntax: boolean): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const { doc, selection } = state;

  const selectionTouches = (from: number, to: number) =>
    revealsSyntax && selection.ranges.some((range) => range.from <= to && range.to >= from);
  const selectionTouchesLines = (from: number, to: number) =>
    selectionTouches(doc.lineAt(from).from, doc.lineAt(to).to);
  const staysOnOneLine = (from: number, to: number) => doc.lineAt(from).to >= to;
  const withFollowingSpace = (to: number) =>
    /[ \t]/.test(doc.sliceString(to, to + 1)) ? to + 1 : to;

  function showSyntax(from: number, to: number, isRevealed: boolean) {
    if (from >= to) return;
    if (isRevealed || !staysOnOneLine(from, to)) decorations.push(visibleSyntax.range(from, to));
    else decorations.push(hiddenSyntax.range(from, to));
  }

  function styleLines(
    from: number,
    to: number,
    className: (index: number, last: number) => string,
  ) {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let number = first; number <= last; number += 1)
      decorations.push(
        Decoration.line({ class: className(number - first, last - first) }).range(
          doc.line(number).from,
        ),
      );
  }

  function decorateLink(node: SyntaxNode) {
    const marks = node.getChildren('LinkMark');
    if (marks.length < 2) return;
    const [opening, closing] = marks;
    const isRevealed = selectionTouches(node.from, node.to);
    if (opening.to < closing.from) decorations.push(linkText.range(opening.to, closing.from));
    showSyntax(opening.from, opening.to, isRevealed);
    if (node.getChild('URL')) showSyntax(closing.from, node.to, isRevealed);
    else showSyntax(closing.from, closing.to, true);
  }

  function decorateImage(node: SyntaxNode) {
    const url = node.getChild('URL');
    const marks = node.getChildren('LinkMark');
    const source = url ? doc.sliceString(url.from, url.to) : '';
    if (
      marks.length < 2 ||
      !displayableImageSource(source) ||
      !staysOnOneLine(node.from, node.to) ||
      selectionTouches(node.from, node.to)
    ) {
      decorations.push(visibleSyntax.range(node.from, node.to));
      return;
    }
    const alternativeText = doc.sliceString(marks[0].to, marks[1].from);
    decorations.push(
      Decoration.replace({ widget: new ImageWidget(source, alternativeText) }).range(
        node.from,
        node.to,
      ),
    );
  }

  function decorateHeaderMark(node: SyntaxNode, heading: SyntaxNode) {
    if (heading.name.startsWith('Setext')) {
      decorations.push(visibleSyntax.range(node.from, node.to));
      return;
    }
    const to = node.from === heading.from ? withFollowingSpace(node.to) : node.to;
    showSyntax(node.from, to, selectionTouchesLines(heading.from, heading.to));
  }

  function decorateListMark(node: SyntaxNode) {
    if (node.parent?.parent?.name !== 'BulletList') {
      decorations.push(orderedListMark.range(node.from, node.to));
      return;
    }
    const taskMarker = node.nextSibling?.name === 'Task' ? node.nextSibling.firstChild : null;
    if (taskMarker) {
      const isRevealed = selectionTouches(node.from, taskMarker.to);
      showSyntax(node.from, withFollowingSpace(node.to), isRevealed);
      decorations.push(
        (isRevealed
          ? visibleSyntax
          : Decoration.replace({
              widget: new TaskWidget(/x/i.test(doc.sliceString(taskMarker.from, taskMarker.to))),
            })
        ).range(taskMarker.from, taskMarker.to),
      );
      return;
    }
    decorations.push(
      (selectionTouches(node.from, node.to) ? visibleSyntax : bullet).range(node.from, node.to),
    );
  }

  function decorateTable(node: SyntaxNode) {
    const fillsItsLines =
      doc.lineAt(node.from).from === node.from && doc.lineAt(node.to).to === node.to;
    if (!fillsItsLines || selectionTouches(node.from, node.to)) {
      styleLines(node.from, node.to, () => 'cm-md-table-source');
      return true;
    }
    decorations.push(
      Decoration.replace({
        widget: new TableWidget(doc.sliceString(node.from, node.to)),
        block: true,
      }).range(node.from, node.to),
    );
    return false;
  }

  syntaxTree(state).iterate({
    enter(cursor) {
      const { name, from, to } = cursor;
      const node = cursor.node;
      const parent = node.parent;

      if (name.startsWith('ATXHeading') || name.startsWith('SetextHeading')) {
        const level = name.at(-1);
        const lastLine = name.startsWith('Setext') ? Math.max(from, doc.lineAt(to).from - 1) : from;
        styleLines(from, lastLine, () => `cm-md-heading cm-md-h${level}`);
      } else if (name === 'HeaderMark' && parent) {
        decorateHeaderMark(node, parent);
      } else if (name === 'Blockquote') {
        styleLines(from, to, () => 'cm-md-quote');
      } else if (name === 'QuoteMark') {
        showSyntax(from, withFollowingSpace(to), selectionTouchesLines(from, to));
      } else if (codeBlockNames.has(name)) {
        styleLines(from, to, (index, last) =>
          [
            'cm-md-codeblock',
            index === 0 ? 'cm-md-codeblock-first' : '',
            index === last ? 'cm-md-codeblock-last' : '',
          ]
            .filter(Boolean)
            .join(' '),
        );
      } else if ((name === 'CodeMark' || name === 'CodeInfo') && parent?.name === 'FencedCode') {
        showSyntax(from, to, selectionTouchesLines(parent.from, parent.to));
      } else if (name === 'HorizontalRule') {
        if (!selectionTouchesLines(from, to)) decorations.push(rule.range(from, to));
        else decorations.push(visibleSyntax.range(from, to));
      } else if (name === 'ListMark') {
        decorateListMark(node);
      } else if (name in inlineStyles) {
        decorations.push(inlineStyles[name].range(from, to));
      } else if (inlineMarkNames.has(name) && parent && inlineMarkParents.has(parent.name)) {
        showSyntax(from, to, selectionTouches(parent.from, parent.to));
      } else if (name === 'URL' && parent && !urlOwners.has(parent.name)) {
        decorations.push(linkText.range(from, to));
      } else if (name === 'Link') {
        decorateLink(node);
      } else if (name === 'Image') {
        decorateImage(node);
        return false;
      } else if (name === 'Table') {
        return decorateTable(node);
      } else if (name === 'TableDelimiter') {
        decorations.push(visibleSyntax.range(from, to));
      } else if (name === 'Escape') {
        showSyntax(from, from + 1, selectionTouches(from, to));
      }
      return true;
    },
  });

  return Decoration.set(decorations, true);
}

const focusChange = StateEffect.define<boolean>();

const livePreviewField = StateField.define<{ hasFocus: boolean; decorations: DecorationSet }>({
  create: (state) => ({ hasFocus: false, decorations: livePreviewDecorations(state, false) }),
  update(preview, transaction) {
    const hasFocus = transaction.effects.reduce(
      (current, effect) => (effect.is(focusChange) ? effect.value : current),
      preview.hasFocus,
    );
    const isUnchanged =
      hasFocus === preview.hasFocus &&
      !transaction.docChanged &&
      !transaction.selection &&
      syntaxTree(transaction.startState) === syntaxTree(transaction.state);
    if (isUnchanged) return preview;
    return { hasFocus, decorations: livePreviewDecorations(transaction.state, hasFocus) };
  },
  provide: (field) => EditorView.decorations.from(field, (preview) => preview.decorations),
});

const focusTracking = EditorView.focusChangeEffect.of((_, isFocused) => focusChange.of(isFocused));

const livePreviewTheme = EditorView.theme({
  '&': { color: 'inherit', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.6' },
  '.cm-content': {
    boxSizing: 'border-box',
    minHeight: 'var(--markdown-editor-min-height, 8rem)',
    padding: '0.5rem 0',
    caretColor: 'var(--foreground)',
  },
  '.cm-line': { padding: '0 0.625rem' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-md-syntax': { color: 'var(--muted-foreground)' },
  '.cm-md-heading': {
    fontFamily: 'var(--font-poppins), sans-serif',
    fontWeight: '600',
    lineHeight: '1.3',
    paddingTop: '0.25em',
    paddingBottom: '0.15em',
  },
  '.cm-md-h1': { fontSize: '1.5em' },
  '.cm-md-h2': { fontSize: '1.3em' },
  '.cm-md-h3': { fontSize: '1.15em' },
  '.cm-md-emphasis': { fontStyle: 'italic' },
  '.cm-md-strikethrough': { textDecoration: 'line-through' },
  '.cm-md-task': {
    margin: '0',
    verticalAlign: 'middle',
    accentColor: 'var(--primary)',
    cursor: 'pointer',
  },
  '.cm-md-table-source': { fontFamily: 'var(--font-mono, monospace)', fontSize: '0.9em' },
  '.cm-md-table-wrapper': { overflowX: 'auto', padding: '0.25rem 0.625rem', cursor: 'text' },
  '.cm-md-table': { borderCollapse: 'collapse', lineHeight: '1.5' },
  '.cm-md-table :is(th, td)': {
    border: '1px solid var(--border)',
    padding: '0.375rem 0.75rem',
    overflowWrap: 'anywhere',
    verticalAlign: 'top',
  },
  '.cm-md-table th': { backgroundColor: 'var(--muted)', fontWeight: '600' },
  '.cm-md-table code': {
    borderRadius: '0.25rem',
    backgroundColor: 'var(--muted)',
    padding: '0.125rem 0.25rem',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.9em',
  },
  '.cm-md-strong': { fontWeight: '700' },
  '.cm-md-code': {
    borderRadius: '0.25rem',
    backgroundColor: 'var(--muted)',
    padding: '0.125rem 0.25rem',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.9em',
  },
  '.cm-md-link': {
    color: 'var(--primary)',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
  },
  '.cm-md-quote': {
    marginLeft: '0.625rem',
    borderLeft: '4px solid var(--border)',
    paddingLeft: '1rem',
    color: 'var(--muted-foreground)',
  },
  '.cm-md-codeblock': {
    margin: '0 0.625rem',
    backgroundColor: 'var(--muted)',
    padding: '0 0.75rem',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.9em',
  },
  '.cm-md-codeblock-first': {
    borderTopLeftRadius: '0.375rem',
    borderTopRightRadius: '0.375rem',
    paddingTop: '0.25rem',
  },
  '.cm-md-codeblock-last': {
    borderBottomLeftRadius: '0.375rem',
    borderBottomRightRadius: '0.375rem',
    paddingBottom: '0.25rem',
  },
  '.cm-md-bullet': { color: 'var(--muted-foreground)' },
  '.cm-md-list-number': { color: 'var(--muted-foreground)' },
  '.cm-md-rule': {
    display: 'inline-block',
    width: '100%',
    borderTop: '1px solid var(--border)',
    verticalAlign: 'middle',
  },
  '.cm-md-image': {
    display: 'inline-block',
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '0.375rem',
    verticalAlign: 'top',
  },
});

export const markdownLivePreview = [livePreviewField, focusTracking, livePreviewTheme];
