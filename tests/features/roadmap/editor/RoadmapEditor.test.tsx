import { createRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { RoadmapEditor } from '@/features/roadmap/editor/RoadmapEditor';
import type { RoadmapEditorProps } from '@/features/roadmap/editor/types';
import type { RoadmapDto, RoadmapNode } from '@/features/roadmap/types';
import { SidebarProvider } from '@/shared/ui/sidebar';

const node: RoadmapNode = {
  id: 'node-1',
  title: 'Límites',
  description: 'Información guardada',
  nodeTypeId: 'content',
  positionX: 0,
  positionY: 0,
  isVisible: true as const,
  isTeacherBlocked: true,
  resources: [],
};

const roadmap: RoadmapDto = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    {
      id: 'content',
      name: 'Contenido',
      icon: 'BookOpen' as const,
      color: '#024AD8',
      isPredefined: true,
    },
    {
      id: 'assessment',
      name: 'Evaluación',
      icon: 'BookOpen',
      color: '#024AD8',
      isPredefined: true,
    },
  ],
  nodes: [node],
  dependencies: [],
};

type EditorHarnessProps = RoadmapEditorProps;

function EditorHarness(props: EditorHarnessProps) {
  return <RoadmapEditor {...props} />;
}

function editorProps(overrides: Partial<EditorHarnessProps> = {}): EditorHarnessProps {
  return {
    roadmap,
    selectedNode: node,
    isVisibilityPending: false,
    isOpen: true,
    onClose: vi.fn(),
    onUpdateNode: vi.fn().mockResolvedValue(true),
    onToggleVisibility: vi.fn().mockResolvedValue(true),
    onRequestTeacherBlock: vi.fn(),
    onDeleteNode: vi.fn().mockResolvedValue(true),
    onAddResource: vi.fn().mockResolvedValue(true),
    onUploadResource: vi.fn().mockResolvedValue(true),
    onUpdateResource: vi.fn().mockResolvedValue(true),
    onDeleteResource: vi.fn().mockResolvedValue(true),
    onPreview: vi.fn(),
    previewButtonRef: createRef<HTMLButtonElement>(),
    panelWidth: 360,
    onPanelWidthChange: vi.fn(),
    ...overrides,
  };
}

test('keeps the node-information draft when returning from the full-canvas preview', async () => {
  const user = userEvent.setup();
  const props = editorProps();
  const { rerender } = render(
    <SidebarProvider>
      <EditorHarness {...props} />
    </SidebarProvider>,
  );

  const title = await screen.findByLabelText('Título');
  await user.clear(title);
  await user.type(title, 'Límites y continuidad');
  expect(screen.getByRole('button', { name: 'Previsualizar cambios' })).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Previsualizar cambios' }));
  expect(props.onPreview).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Límites y continuidad',
      access: { status: 'ACCESSIBLE' },
      canComplete: true,
    }),
  );

  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen={false} />
    </SidebarProvider>,
  );
  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen />
    </SidebarProvider>,
  );

  expect(((await screen.findByLabelText('Título')) as HTMLInputElement).value).toBe(
    'Límites y continuidad',
  );
});

test('continues treating a retained draft as dirty after the editor panel closes', async () => {
  const user = userEvent.setup();
  const props = editorProps();
  const { rerender } = render(
    <SidebarProvider>
      <EditorHarness {...props} />
    </SidebarProvider>,
  );

  await user.clear(await screen.findByLabelText('Título'));
  await user.type(screen.getByLabelText('Título'), 'Límites y continuidad');
  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen={false} />
    </SidebarProvider>,
  );
  rerender(
    <SidebarProvider>
      <EditorHarness {...props} isOpen />
    </SidebarProvider>,
  );

  expect(screen.getByRole('button', { name: 'Previsualizar cambios' })).toBeTruthy();
});

test('opens the existing resource composer and moves focus to its file field on request', async () => {
  render(
    <SidebarProvider>
      <EditorHarness {...editorProps({ resourceComposerRequest: 1 })} />
    </SidebarProvider>,
  );

  const file = await screen.findByLabelText('Archivo');
  await waitFor(() => expect(document.activeElement).toBe(file));
});

test('uses the shared node-panel chrome for an effortless mode transition', () => {
  render(
    <SidebarProvider>
      <EditorHarness {...editorProps()} />
    </SidebarProvider>,
  );

  const panel = screen.getByLabelText('Panel de edición del roadmap');
  expect(panel.className).toContain('bg-card');
  expect(panel.className).toContain('shadow-(--shadow-roadmap-panel)');
  expect(screen.getByRole('group', { name: 'Acciones del nodo' })).toBeTruthy();
});
