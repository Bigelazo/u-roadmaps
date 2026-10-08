import { describe, expect, it } from 'vitest';
import { fileResourceUrl } from '@/features/roadmap/domain/resource';
import { planRoadmapCopy, type RoadmapCopySource } from '@/features/roadmap/domain/roadmap-copy';

function sequentialIds() {
  let next = 0;
  return () => `new-${++next}`;
}

const source: RoadmapCopySource = {
  customNodeTypes: [{ id: 'type-custom', name: 'Taller', icon: 'wrench', color: '#123456' }],
  nodes: [
    {
      id: 'visible',
      nodeTypeId: 'type-custom',
      title: 'Visible',
      description: '# Hola',
      positionX: 10,
      positionY: 20,
      isVisible: true,
    },
    {
      id: 'scheduled',
      nodeTypeId: 'type-predefined',
      title: 'Programado',
      description: null,
      positionX: 30,
      positionY: 40,
      isVisible: true,
    },
    {
      id: 'hidden',
      nodeTypeId: 'type-predefined',
      title: 'Oculto',
      description: null,
      positionX: 50,
      positionY: 60,
      isVisible: false,
    },
  ],
  dependencies: [
    {
      sourceNodeId: 'visible',
      targetNodeId: 'hidden',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    },
  ],
  resources: [
    { roadmapNodeId: 'visible', title: 'Guía', url: 'https://example.com', type: 'LINK' },
    { roadmapNodeId: 'visible', title: 'Clase', url: 'https://video.example', type: 'VIDEO' },
    {
      roadmapNodeId: 'hidden',
      title: 'Apunte',
      url: 'https://files.u-roadmaps.invalid/key-a',
      type: 'FILE',
      fileKey: 'key-a',
      fileContentType: 'application/pdf',
    },
  ],
};

describe('planRoadmapCopy', () => {
  const plan = planRoadmapCopy(source, 'roadmap-new', sequentialIds());
  const nodeById = (title: string) => plan.nodes.find((node) => node.title === title)!;

  it('gives every copied row a fresh identity in the new Roadmap', () => {
    const ids = [
      ...plan.nodeTypes.map(({ id }) => id),
      ...plan.nodes.map(({ id }) => id),
      ...plan.dependencies.map(({ id }) => id),
      ...plan.resources.map(({ id }) => id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('new-'))).toBe(true);
    expect(plan.nodes.every(({ roadmapId }) => roadmapId === 'roadmap-new')).toBe(true);
    expect(plan.nodeTypes).toEqual([
      {
        id: expect.any(String),
        roadmapId: 'roadmap-new',
        name: 'Taller',
        normalizedName: 'taller',
        icon: 'wrench',
        color: '#123456',
      },
    ]);
  });

  it('starts visible Nodes Teacher-blocked and keeps hidden Nodes hidden and unblocked', () => {
    expect(nodeById('Visible')).toMatchObject({
      isVisible: true,
      description: '# Hola',
      positionX: 10,
      positionY: 20,
    });
    expect(nodeById('Programado')).toMatchObject({ isTeacherBlocked: true });
    expect(nodeById('Oculto')).toMatchObject({
      isVisible: false,
    });
  });

  it('drops every Scheduled unlock', () => {
    expect(plan.nodes.map(({ teacherUnlockOn }) => teacherUnlockOn)).toEqual([null, null, null]);
  });

  it('remaps Custom node types and keeps Predefined node types shared', () => {
    expect(nodeById('Visible').nodeTypeId).toBe(plan.nodeTypes[0]!.id);
    expect(nodeById('Oculto').nodeTypeId).toBe('type-predefined');
  });

  it('remaps Dependencies with their handles', () => {
    expect(plan.dependencies).toEqual([
      {
        id: expect.any(String),
        sourceNodeId: nodeById('Visible').id,
        targetNodeId: nodeById('Oculto').id,
        sourceHandle: 'bottom',
        targetHandle: 'top',
      },
    ]);
  });

  it('copies link and video Resources as they are', () => {
    expect(plan.resources.slice(0, 2)).toEqual([
      {
        id: expect.any(String),
        roadmapNodeId: nodeById('Visible').id,
        title: 'Guía',
        url: 'https://example.com',
        type: 'LINK',
        fileKey: null,
        fileContentType: null,
      },
      {
        id: expect.any(String),
        roadmapNodeId: nodeById('Visible').id,
        title: 'Clase',
        url: 'https://video.example',
        type: 'VIDEO',
        fileKey: null,
        fileContentType: null,
      },
    ]);
  });

  it('gives each file Resource a new file key and records the bytes to copy', () => {
    const file = plan.resources[2]!;
    expect(file).toEqual({
      id: expect.any(String),
      roadmapNodeId: nodeById('Oculto').id,
      title: 'Apunte',
      url: fileResourceUrl(file.fileKey!),
      type: 'FILE',
      fileKey: expect.stringMatching(/^new-/),
      fileContentType: 'application/pdf',
    });
    expect(plan.fileCopies).toEqual([
      { resourceId: file.id, sourceFileKey: 'key-a', fileKey: file.fileKey },
    ]);
  });
});
