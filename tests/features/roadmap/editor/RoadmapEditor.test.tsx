import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
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
    { id: 'content', name: 'Contenido', icon: 'BookOpen' as const, color: '#024AD8', isPredefined: true },
    { id: 'assessment', name: 'Evaluación', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [node],
  dependencies: [],
};

function editorProps(overrides: Partial<RoadmapEditorProps> = {}): RoadmapEditorProps {
  return {
    roadmap,
    selectedNode: node,
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
      <RoadmapEditor {...props} />
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
      <RoadmapEditor {...props} isOpen={false} />
    </SidebarProvider>,
  );
  rerender(
    <SidebarProvider>
      <RoadmapEditor {...props} isOpen />
    </SidebarProvider>,
  );

  expect((await screen.findByLabelText('Título') as HTMLInputElement).value).toBe(
    'Límites y continuidad',
  );
});
