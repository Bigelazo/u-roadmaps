import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
