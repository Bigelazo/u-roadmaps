import { type CSSProperties } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { panelWidthLimits, usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';
import { Sidebar, SidebarProvider, SidebarRail } from '@/shared/ui/sidebar';

function ResizablePanelFixture({ storageKey }: { storageKey: string }) {
  const { width, setWidth } = usePersistentPanelWidth({
    storageKey,
    initialWidth: 400,
    limits: panelWidthLimits,
  });

  return (
    <SidebarProvider
      className="relative min-h-0"
      style={{ '--sidebar-width': `${width}px` } as CSSProperties}
    >
      <output aria-label="Ancho del panel">{width}</output>
      <Sidebar side="right" collapsible="none">
        <SidebarRail
          ariaLabel="Redimensionar panel de prueba"
          controlsId="test-panel"
          value={width}
          min={panelWidthLimits.min}
          max={panelWidthLimits.max}
          onValueChange={setWidth}
        />
        <div id="test-panel" />
      </Sidebar>
    </SidebarProvider>
  );
}

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

test('restores each panel profile width independently and persists keyboard changes', async () => {
  window.localStorage.clear();
  window.localStorage.setItem('teacher-panel-width', '500');
  window.localStorage.setItem('student-panel-width', '360');
  const user = userEvent.setup();

  const { rerender } = render(<ResizablePanelFixture storageKey="teacher-panel-width" />);

  await waitFor(() =>
    expect(
      screen
        .getByRole('separator', { name: 'Redimensionar panel de prueba' })
        .getAttribute('aria-valuenow'),
    ).toBe('500'),
  );
  await user.tab();
  await user.keyboard('{ArrowRight}');
  expect(window.localStorage.getItem('teacher-panel-width')).toBe('520');
  expect(screen.getByLabelText('Ancho del panel').textContent).toBe('520');

  rerender(<ResizablePanelFixture storageKey="student-panel-width" />);
  await waitFor(() => expect(screen.getByLabelText('Ancho del panel').textContent).toBe('360'));
  expect(window.localStorage.getItem('teacher-panel-width')).toBe('520');
});

test('keeps resizing within its readable minimum and canvas-preserving maximum', async () => {
  window.localStorage.clear();
  const user = userEvent.setup();
  render(<ResizablePanelFixture storageKey="panel-width" />);

  const separator = screen.getByRole('separator', { name: 'Redimensionar panel de prueba' });
  expect(separator.getAttribute('aria-valuenow')).toBe('400');
  await user.tab();
  await user.keyboard('{Home}');
  expect(separator.getAttribute('aria-valuenow')).toBe(String(panelWidthLimits.min));
  await user.keyboard('{ArrowLeft}');
  expect(separator.getAttribute('aria-valuenow')).toBe(String(panelWidthLimits.min));

  await user.keyboard('{End}');
  expect(separator.getAttribute('aria-valuenow')).toBe(String(panelWidthLimits.max));
  await user.keyboard('{ArrowRight}');
  expect(separator.getAttribute('aria-valuenow')).toBe(String(panelWidthLimits.max));
  expect(separator.getAttribute('aria-orientation')).toBe('vertical');
  expect(separator.getAttribute('aria-controls')).toBe('test-panel');
});
