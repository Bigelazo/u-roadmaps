import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MarkdownEditor } from '@/features/roadmap/editor/MarkdownEditor';
import { markdownText, placeMarkdownCursor, writeMarkdown } from '../../../support/markdown-editor';

function Editor() {
  const [value, setValue] = useState('Borrador original');
  return <MarkdownEditor aria-label="Descripción" value={value} onValueChange={setValue} />;
}

function dropFiles(files: File[]) {
  fireEvent.drop(screen.getByRole('textbox', { name: 'Descripción' }), {
    dataTransfer: { types: ['Files'], files },
  });
}

test.each([
  ['guia.md', '# Guía\n\n**Descripción** con ñ y acentos.\n'],
  ['GUIA.MARKDOWN', '## Otro contenido'],
  ['vacio.md', ''],
])('replaces the entire draft with %s only after confirmation', async (name, content) => {
  const user = userEvent.setup();
  render(<Editor />);
  const input = screen.getByRole('textbox');
  dropFiles([new File([content], name)]);

  expect(markdownText(input)).toBe('Borrador original');
  expect(screen.getByRole('alertdialog').textContent).toContain(name);
  await user.click(screen.getByRole('button', { name: 'Reemplazar texto' }));

  await waitFor(() => expect(markdownText(screen.getByRole('textbox'))).toBe(content));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('cancelling or dismissing the confirmation preserves the draft', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const file = new File(['Texto importado'], 'guia.md');
  dropFiles([file]);
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(markdownText(screen.getByRole('textbox'))).toBe('Borrador original');

  dropFiles([file]);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(markdownText(screen.getByRole('textbox'))).toBe('Borrador original');
});

test.each([
  [[new File(['PDF'], 'guia.pdf')]],
  [[new File(['Uno'], 'uno.md'), new File(['Dos'], 'dos.md')]],
])('rejects unsupported or multiple files without changing the draft (%#)', (files) => {
  render(<Editor />);
  dropFiles(files);
  expect(screen.getByRole('alert').textContent).toContain('un solo archivo Markdown');
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(markdownText(screen.getByRole('textbox'))).toBe('Borrador original');
});

test.each([{ readOnly: true }, { disabled: true }])(
  'does not import files into a non-editable field (%#)',
  (props) => {
    const onValueChange = vi.fn();
    render(<MarkdownEditor {...props} value="Original" onValueChange={onValueChange} />);
    fireEvent.drop(screen.getByRole('textbox'), {
      dataTransfer: { types: ['Files'], files: [new File(['Nuevo'], 'guia.md')] },
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  },
);

test('a read failure preserves the draft and reports the problem', async () => {
  const user = userEvent.setup();
  const read = vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (
    this: FileReader,
  ) {
    this.dispatchEvent(new ProgressEvent('error'));
  });
  try {
    render(<Editor />);
    dropFiles([new File(['Nuevo'], 'guia.md')]);
    await user.click(screen.getByRole('button', { name: 'Reemplazar texto' }));
    expect(screen.getByRole('alert').textContent).toContain('No se pudo leer el archivo');
    expect(markdownText(screen.getByRole('textbox'))).toBe('Borrador original');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  } finally {
    read.mockRestore();
  }
});

const dropTargetMessage = 'Suelta el archivo Markdown aquí';

function dragOverWith(dataTransfer: { types: string[]; items: { kind: string; type: string }[] }) {
  fireEvent.dragOver(screen.getByRole('textbox'), { dataTransfer: { files: [], ...dataTransfer } });
}

function fileItems(...types: string[]) {
  return { types: ['Files'], items: types.map((type) => ({ kind: 'file', type })) };
}

test.each([
  ['a Markdown media type', fileItems('text/markdown')],
  ['the legacy Markdown media type', fileItems('text/x-markdown')],
  ['a file whose type the browser cannot tell', fileItems('')],
  ['a drag that hides its items until the drop', { types: ['Files'], items: [] }],
])('offers itself as a drop target while dragging %s', (_, dataTransfer) => {
  render(<Editor />);
  expect(screen.queryByText(dropTargetMessage)).toBeNull();
  dragOverWith(dataTransfer);
  expect(screen.getByText(dropTargetMessage)).toBeTruthy();
});

test.each([
  ['another file type', fileItems('application/pdf')],
  ['several files', fileItems('text/markdown', 'text/markdown')],
  ['selected text', { types: ['text/plain'], items: [{ kind: 'string', type: 'text/plain' }] }],
])('does not offer itself as a drop target while dragging %s', (_, dataTransfer) => {
  render(<Editor />);
  dragOverWith(dataTransfer);
  expect(screen.queryByText(dropTargetMessage)).toBeNull();
});

test.each([{ readOnly: true }, { disabled: true }])(
  'a non-editable field does not offer itself as a drop target (%#)',
  (props) => {
    render(<MarkdownEditor {...props} value="Original" onValueChange={vi.fn()} />);
    dragOverWith(fileItems('text/markdown'));
    expect(screen.queryByText(dropTargetMessage)).toBeNull();
  },
);

test('keeps the drop target when the file leaves the field for the rest of the window', () => {
  render(<Editor />);
  dragOverWith(fileItems('text/markdown'));
  fireEvent.dragLeave(screen.getByRole('textbox'));
  expect(screen.getByText(dropTargetMessage)).toBeTruthy();
});

test('the drop target clears when the file is dropped', () => {
  render(<Editor />);
  dragOverWith(fileItems('text/markdown'));
  dropFiles([new File(['Nuevo'], 'guia.md')]);
  expect(screen.queryByText(dropTargetMessage)).toBeNull();
});

function dragEnterWindow(dataTransfer = fileItems('text/markdown')) {
  fireEvent.dragEnter(document.body, { dataTransfer: { files: [], ...dataTransfer } });
}

function dragLeaveAt(clientX: number, clientY: number) {
  fireEvent(
    document.body,
    new MouseEvent('dragleave', { bubbles: true, clientX, clientY, relatedTarget: null }),
  );
}

test('offers itself as a drop target as soon as a Markdown file enters the window', () => {
  render(<Editor />);
  dragEnterWindow();
  expect(screen.getByText(dropTargetMessage)).toBeTruthy();
});

test('does not offer itself as a drop target when another file enters the window', () => {
  render(<Editor />);
  dragEnterWindow(fileItems('application/pdf'));
  expect(screen.queryByText(dropTargetMessage)).toBeNull();
});

test('keeps the drop target while the file moves between elements of the window', () => {
  render(<Editor />);
  dragEnterWindow();
  dragLeaveAt(200, 200);
  expect(screen.getByText(dropTargetMessage)).toBeTruthy();
});

test('the drop target clears when the file leaves the window', () => {
  render(<Editor />);
  dragEnterWindow();
  dragLeaveAt(0, 200);
  expect(screen.queryByText(dropTargetMessage)).toBeNull();
});

test('the drop target clears when the drag stops reaching the window', () => {
  vi.useFakeTimers();
  try {
    render(<Editor />);
    dragEnterWindow();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByText(dropTargetMessage)).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText(dropTargetMessage)).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test('a file dropped outside the field is not opened by the browser', () => {
  render(<Editor />);
  const dataTransfer = { files: [], dropEffect: 'copy', ...fileItems('text/markdown') };
  const dragContinues = fireEvent.dragOver(document.body, { dataTransfer });
  expect(dragContinues).toBe(false);
  expect(dataTransfer.dropEffect).toBe('none');
});

function renderedLines() {
  return Array.from(
    screen.getByRole('textbox').querySelectorAll('.cm-line'),
    (line) => line.textContent,
  );
}

const formatted = '# Guía\n\nTexto **fuerte**, *suave*, `código` y [enlace](https://example.com).';

test('renders formatted text without its Markdown syntax', () => {
  render(<Editor />);
  const input = screen.getByRole('textbox');
  writeMarkdown(input, formatted);

  expect(renderedLines()).toEqual(['Guía', '', 'Texto fuerte, suave, código y enlace.']);
  expect(screen.getByText('Guía').className).toContain('cm-md-h1');
  expect(screen.getByText('fuerte').className).toBe('cm-md-strong');
  expect(screen.getByText('suave').className).toBe('cm-md-emphasis');
  expect(screen.getByText('código').className).toBe('cm-md-code');
  expect(screen.getByText('enlace').className).toBe('cm-md-link');
  expect(markdownText(input)).toBe(formatted);
});

test('reveals the syntax of the formatted content the cursor enters', async () => {
  render(<Editor />);
  const input = screen.getByRole('textbox');
  writeMarkdown(input, formatted);

  placeMarkdownCursor(input, formatted.indexOf('fuerte'));
  await waitFor(() =>
    expect(renderedLines()).toEqual(['Guía', '', 'Texto **fuerte**, suave, código y enlace.']),
  );

  placeMarkdownCursor(input, formatted.indexOf('enlace'));
  await waitFor(() =>
    expect(renderedLines()).toEqual([
      'Guía',
      '',
      'Texto fuerte, suave, código y [enlace](https://example.com).',
    ]),
  );

  placeMarkdownCursor(input, 3);
  await waitFor(() =>
    expect(renderedLines()).toEqual(['# Guía', '', 'Texto fuerte, suave, código y enlace.']),
  );
});

test('hides the syntax again when the field loses focus', async () => {
  render(<Editor />);
  const input = screen.getByRole('textbox');
  writeMarkdown(input, formatted);
  placeMarkdownCursor(input, 3);

  act(() => input.blur());
  await waitFor(() => expect(renderedLines()[0]).toBe('Guía'));
});

test('renders list bullets, quotes and rules in place of their markers', () => {
  render(<Editor />);
  writeMarkdown(screen.getByRole('textbox'), '- Uno\n\n> Cita\n\n---\n\n```js\nlet a;\n```');

  expect(renderedLines()).toEqual(['• Uno', '', 'Cita', '', '', '', '', 'let a;', '']);
  expect(screen.getByText('let a;').className).toContain('cm-md-codeblock');
  expect(screen.getByText('Cita').className).toContain('cm-md-quote');
});

test('an edit reports the Markdown source, not the rendered text', () => {
  const onValueChange = vi.fn();
  render(<MarkdownEditor value="" onValueChange={onValueChange} />);
  writeMarkdown(screen.getByRole('textbox'), '**fuerte**');
  expect(onValueChange).toHaveBeenLastCalledWith('**fuerte**');
});

test('a value with Windows line breaks is shown without reporting an edit', () => {
  const onValueChange = vi.fn();
  render(<MarkdownEditor value={'Uno\r\nDos'} onValueChange={onValueChange} />);
  expect(renderedLines()).toEqual(['Uno', 'Dos']);
  expect(onValueChange).not.toHaveBeenCalled();
});

test('renders strikethrough and task lists in place of their syntax', () => {
  render(<Editor />);
  writeMarkdown(screen.getByRole('textbox'), '~~viejo~~\n\n- [ ] Pendiente\n- [x] Hecha');

  expect(screen.getByText('viejo').className).toBe('cm-md-strikethrough');
  expect(renderedLines()).toEqual(['viejo', '', ' Pendiente', ' Hecha']);
  expect(screen.getByRole('checkbox', { name: 'Marcar como hecha' })).toHaveProperty(
    'checked',
    false,
  );
  expect(screen.getByRole('checkbox', { name: 'Marcar como pendiente' })).toHaveProperty(
    'checked',
    true,
  );
});

test('clicking a task checkbox toggles it in the Markdown source', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const input = screen.getByRole('textbox');
  writeMarkdown(input, '- [ ] Pendiente');

  await user.click(screen.getByRole('checkbox', { name: 'Marcar como hecha' }));
  expect(markdownText(input)).toBe('- [x] Pendiente');

  await user.click(screen.getByRole('checkbox', { name: 'Marcar como pendiente' }));
  expect(markdownText(input)).toBe('- [ ] Pendiente');
});

const table = '| Nombre | Nota |\n| :-- | --: |\n| **Ana** | 7 |\n| Luis | |';

test('renders a table with its formatted cells and alignment', () => {
  render(<Editor />);
  writeMarkdown(screen.getByRole('textbox'), table);

  expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
    'Nombre',
    'Nota',
  ]);
  expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
    'Ana',
    '7',
    'Luis',
    '',
  ]);
  expect(screen.getByText('Ana').tagName).toBe('STRONG');
  expect(screen.getByRole('cell', { name: '7' }).style.textAlign).toBe('right');
});

test('a table shows its source while the cursor is inside it', async () => {
  render(<Editor />);
  const input = screen.getByRole('textbox');
  writeMarkdown(input, `Antes\n\n${table}`);

  fireEvent.mouseDown(screen.getByRole('cell', { name: 'Luis' }));
  await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
  expect(renderedLines().slice(2)).toEqual(table.replace('**Ana**', 'Ana').split('\n'));

  placeMarkdownCursor(input, 0);
  expect(await screen.findByRole('table')).toBeTruthy();
});

function pressTab(shiftKey = false) {
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab', code: 'Tab', keyCode: 9, shiftKey });
}

test('Tab inserts a tab at the cursor instead of leaving the field', () => {
  render(<Editor />);
  const input = screen.getByRole('textbox');
  writeMarkdown(input, 'Texto');
  placeMarkdownCursor(input, 5);

  pressTab();
  expect(markdownText(input)).toBe('Texto\t');
});

test('Tab and Shift+Tab nest and unnest a list item', () => {
  render(<Editor />);
  const input = screen.getByRole('textbox');
  writeMarkdown(input, '- Uno\n- Dos');
  placeMarkdownCursor(input, 11);

  pressTab();
  expect(markdownText(input)).toBe('- Uno\n\t- Dos');

  pressTab(true);
  expect(markdownText(input)).toBe('- Uno\n- Dos');
});
