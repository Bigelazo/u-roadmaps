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

test('presents the editor as a non-modal bottom sheet in the compact layout', () => {
  mockViewport(640);
  renderPanel();

  const panel = screen.getByRole('dialog', { name: 'Panel de edición del roadmap' });
  expect(panel.getAttribute('data-side')).toBe('bottom');
  expect(panel.id).toBe('roadmap-editor-panel');
  expect(screen.getByRole('group', { name: 'Editor de nodo' })).toBeTruthy();
  expect(screen.getByLabelText('Título')).toBeTruthy();
  // eslint-disable-next-line testing-library/no-node-access -- the overlay has no role or name.
  expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
});
