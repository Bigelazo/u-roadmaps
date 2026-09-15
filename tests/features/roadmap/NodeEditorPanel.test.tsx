import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { NodeEditorPanel } from '@/features/roadmap/ui/NodeEditorPanel';
import { SidebarProvider } from '@/shared/ui/sidebar';

function renderPanel(isOpen = true) {
  return render(
    <SidebarProvider>
      <NodeEditorPanel isOpen={isOpen} panelWidth={360} onPanelWidthChange={vi.fn()}>
        <label>
          Título
          <input defaultValue="Límites" />
        </label>
      </NodeEditorPanel>
    </SidebarProvider>,
  );
}

test('keeps the editor DOM and draft field mounted while the panel is hidden', async () => {
  const user = userEvent.setup();
  const { rerender } = renderPanel();
  const input = screen.getByLabelText('Título');

  await user.clear(input);
  await user.type(input, 'Límites y continuidad');

  rerender(
    <SidebarProvider>
      <NodeEditorPanel isOpen={false} panelWidth={360} onPanelWidthChange={vi.fn()}>
        <label>
          Título
          <input defaultValue="Límites" />
        </label>
      </NodeEditorPanel>
    </SidebarProvider>,
  );

  const panel = screen.getByLabelText('Panel de edición del roadmap');
  expect(panel.hasAttribute('hidden')).toBe(true);
  expect(screen.getByLabelText('Título')).toBe(input);
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Límites y continuidad');

  rerender(
    <SidebarProvider>
      <NodeEditorPanel isOpen panelWidth={360} onPanelWidthChange={vi.fn()}>
        <label>
          Título
          <input defaultValue="Límites" />
        </label>
      </NodeEditorPanel>
    </SidebarProvider>,
  );

  expect(panel.hasAttribute('hidden')).toBe(false);
  expect(screen.getByLabelText('Título')).toBe(input);
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Límites y continuidad');
});

test('keeps mobile disclosure state in the panel shell', async () => {
  const user = userEvent.setup();
  renderPanel();

  const details = screen.getByRole('group', { name: 'Editor de nodo' }) as HTMLDetailsElement;
  await user.click(screen.getByText('Editor de nodo'));

  expect(details.open).toBe(true);
});
