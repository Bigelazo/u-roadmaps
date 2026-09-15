import { expect, test } from 'vitest';
import {
  hasUnsavedNodeInformation,
  projectNodeInformationPreview,
} from '@/features/roadmap/editor/node-information-preview';
import type { RoadmapNode } from '@/features/roadmap/types';
import type { ResourceSession } from '@/features/roadmap/editor/types';

const hiddenNode: RoadmapNode = {
  id: 'node-1',
  title: 'Límites',
  description: 'Información guardada',
  nodeTypeId: 'content',
  positionX: 20,
  positionY: 40,
  isVisible: false,
  isTeacherBlocked: false,
  isCompleted: true,
  canComplete: false,
  resources: [
    {
      id: 'resource-1',
      title: 'Guía inicial',
      url: 'https://example.test/guia',
      type: 'LINK',
    },
  ],
};

const cleanResourceSession: ResourceSession = { kind: 'closed' };

test('treats node-type and resource sessions as unsaved information', () => {
  const nodeValue = {
    title: hiddenNode.title,
    description: hiddenNode.description!,
    nodeTypeId: 'lab',
  };

  expect(hasUnsavedNodeInformation(hiddenNode, nodeValue, cleanResourceSession)).toBe(true);
  expect(
    hasUnsavedNodeInformation(
      hiddenNode,
      { ...nodeValue, nodeTypeId: hiddenNode.nodeTypeId },
      {
        kind: 'adding-link',
        value: { title: 'Guía nueva', url: 'https://example.test/nueva', type: 'LINK' },
      },
    ),
  ).toBe(true);
});

test('projects every unsaved student-visible change without evaluating access or completion', () => {
  const preview = projectNodeInformationPreview(
    hiddenNode,
    { title: 'Límites y continuidad', description: 'Borrador docente', nodeTypeId: 'assessment' },
    {
      kind: 'adding-link',
      value: { title: 'Guía nueva', url: 'https://example.test/nueva', type: 'LINK' },
    },
  );

  expect(preview).toMatchObject({
    title: 'Límites y continuidad',
    description: 'Borrador docente',
    nodeTypeId: 'assessment',
    isVisible: true,
    access: { status: 'ACCESSIBLE' },
    isCompleted: false,
    canComplete: true,
  });
  expect(preview.resources).toEqual([
    hiddenNode.resources[0],
    {
      id: 'node-information-preview-resource',
      title: 'Guía nueva',
      url: 'https://example.test/nueva',
      type: 'LINK',
    },
  ]);
});

test('overlays an edited resource instead of duplicating it in the preview', () => {
  const preview = projectNodeInformationPreview(
    hiddenNode,
    {
      title: hiddenNode.title,
      description: hiddenNode.description!,
      nodeTypeId: hiddenNode.nodeTypeId,
    },
    {
      kind: 'editing-existing',
      resourceId: 'resource-1',
      value: {
        title: 'Guía actualizada',
        url: 'https://example.test/actualizada',
        type: 'LINK',
      },
    },
  );

  expect(preview.resources).toEqual([
    {
      id: 'resource-1',
      title: 'Guía actualizada',
      url: 'https://example.test/actualizada',
      type: 'LINK',
    },
  ]);
});
