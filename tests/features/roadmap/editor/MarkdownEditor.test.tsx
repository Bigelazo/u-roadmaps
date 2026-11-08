import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MarkdownEditor } from '@/features/roadmap/editor/MarkdownEditor';

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

  expect(input).toHaveProperty('value', 'Borrador original');
  expect(screen.getByRole('alertdialog').textContent).toContain(name);
  await user.click(screen.getByRole('button', { name: 'Reemplazar texto' }));

  await waitFor(() => expect(screen.getByRole('textbox')).toHaveProperty('value', content));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});

test('cancelling or dismissing the confirmation preserves the draft', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const file = new File(['Texto importado'], 'guia.md');
  dropFiles([file]);
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByRole('textbox')).toHaveProperty('value', 'Borrador original');

  dropFiles([file]);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByRole('textbox')).toHaveProperty('value', 'Borrador original');
});

test.each([
  [[new File(['PDF'], 'guia.pdf')]],
  [[new File(['Uno'], 'uno.md'), new File(['Dos'], 'dos.md')]],
])('rejects unsupported or multiple files without changing the draft (%#)', (files) => {
  render(<Editor />);
  dropFiles(files);
  expect(screen.getByRole('alert').textContent).toContain('un solo archivo Markdown');
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByRole('textbox')).toHaveProperty('value', 'Borrador original');
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
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Borrador original');
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
