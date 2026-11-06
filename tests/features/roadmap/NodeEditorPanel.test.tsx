import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NodeEditorPanel } from '@/features/roadmap/ui/NodeEditorPanel';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { mockViewport } from '../../support/viewport';

beforeEach(() => mockViewport(1280));
afterEach(() => vi.unstubAllGlobals());

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

test('keeps the draft mounted as the same panel when the viewport crosses the compact breakpoint', async () => {
  const user = userEvent.setup();
  const { rerender } = renderPanel();
  const input = screen.getByLabelText('Título');
  const panel = screen.getByRole('region', { name: 'Panel de edición del roadmap' });
  await user.clear(input);
  await user.type(input, 'Borrador sin guardar');

  mockViewport(820);
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

  expect(screen.getByRole('region', { name: 'Panel de edición del roadmap' })).toBe(panel);
  expect(panel.id).toBe('roadmap-editor-panel');
  expect(screen.getByRole('group', { name: 'Editor de nodo' })).toBeTruthy();
  expect(screen.getByLabelText('Título')).toBe(input);
  expect((input as HTMLInputElement).value).toBe('Borrador sin guardar');
});
