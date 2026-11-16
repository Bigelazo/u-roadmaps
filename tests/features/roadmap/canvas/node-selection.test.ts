import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { deriveCanvasMode } from '@/features/roadmap/canvas/mode';
import {
  useNodeSelection,
  type NodeSelectionOptions,
} from '@/features/roadmap/canvas/node-selection';
import type { CanvasCommand } from '@/features/roadmap/canvas/commands/canvas-command';
import type { RoadmapCanvasExperience } from '@/features/roadmap/session/types';
import type { StudentAccessibleRoadmapNode, StudentRoadmapNode } from '@/features/roadmap/types';

type Nodes = NodeSelectionOptions['nodes'];

function accessibleNode(id: string): StudentRoadmapNode {
  return {
    id,
    title: id,
    positionX: 0,
    positionY: 0,
    nodeTypeId: 'content',
    isVisible: true,
    access: { status: 'ACCESSIBLE' },
    description: null,
    isCompleted: false,
    canComplete: true,
    resources: [],
  };
}

function blockedNode(id: string): StudentRoadmapNode {
  return {
    id,
    title: id,
    positionX: 0,
    positionY: 0,
    nodeTypeId: 'content',
    access: { status: 'BLOCKED', reason: 'TEACHER_BLOCK' },
  };
}

const addNodeCommand: CanvasCommand = {
  kind: 'add-node',
  node: { title: 'Sucesiones', description: '', nodeTypeId: 'content', isVisible: true },
  position: { x: 480, y: 240 },
  displaced: [],
};

const student: RoadmapCanvasExperience = { kind: 'student', term: 'current' };
const editableTeaching: RoadmapCanvasExperience = { kind: 'teaching', term: 'current' };
const readOnlyTeaching: RoadmapCanvasExperience = { kind: 'teaching', term: 'historical' };

function renderNodeSelection({
  experience,
  nodes,
  guardDraft = () => Promise.resolve(true),
  hasDraft = () => false,
}: {
  experience: RoadmapCanvasExperience;
  nodes: Nodes;
  guardDraft?: NodeSelectionOptions['guardDraft'];
  hasDraft?: () => boolean;
}) {
  const reportPracticeAction = vi.fn();
  let props = { nodes, isCanvasPreview: false };
  const { result, rerender } = renderHook(
    ({ nodes, isCanvasPreview }: typeof props) =>
      useNodeSelection({
        nodes,
        mode: deriveCanvasMode({ experience, isCanvasPreview }),
        guardDraft,
        hasDraft,
        reportPracticeAction,
      }),
    { initialProps: props },
  );
  const update = (next: Partial<typeof props>) => {
    props = { ...props, ...next };
    rerender(props);
  };
  return {
    selection: () => result.current,
    reportPracticeAction,
    changeNodes: (next: Nodes) => update({ nodes: next }),
    enterCanvasPreview: () => update({ isCanvasPreview: true }),
    exitCanvasPreview: () => update({ isCanvasPreview: false }),
    act: (operation: (selection: typeof result.current) => unknown) =>
      act(async () => {
        await operation(result.current);
      }),
  };
}

describe('Node selection', () => {
  test('selecting an available Node opens its student detail for a student', async () => {
    const canvas = renderNodeSelection({ experience: student, nodes: [accessibleNode('limits')] });

    await canvas.act((selection) => selection.selectNode('limits'));

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'student-detail' });
  });

  test('a Blocked node is not selected for a student', async () => {
    const canvas = renderNodeSelection({ experience: student, nodes: [blockedNode('limits')] });

    await canvas.act((selection) => selection.selectNode('limits'));

    expect(canvas.selection().selectedNodeId).toBeNull();
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
    expect(canvas.reportPracticeAction).not.toHaveBeenCalled();
  });

  test('selecting a Node on an editable Roadmap opens the Node editor', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
    });

    await canvas.act((selection) => selection.selectNode('limits'));

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'editor' });
  });

  test('selecting a Node on a read-only Roadmap marks it selected without opening a panel', async () => {
    const canvas = renderNodeSelection({
      experience: readOnlyTeaching,
      nodes: [accessibleNode('limits')],
    });

    await canvas.act((selection) => selection.selectNode('limits'));

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
  });

  test('the draft guard can refuse replacing the selected Node', async () => {
    const guardDraft = vi.fn(() => Promise.resolve(true));
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits'), accessibleNode('derivatives')],
      guardDraft,
    });
    await canvas.act((selection) => selection.selectNode('limits'));
    guardDraft.mockResolvedValue(false);

    await canvas.act((selection) => selection.selectNode('derivatives'));

    expect(guardDraft).toHaveBeenCalledWith({ kind: 'replace-node', nodeId: 'derivatives' });
    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'editor' });
  });

  test('the draft guard can refuse closing the selected Node', async () => {
    const guardDraft = vi.fn(() => Promise.resolve(false));
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
      guardDraft,
    });
    await canvas.act((selection) => selection.selectNode('limits'));

    await canvas.act((selection) => selection.closeSelectedNode());

    expect(guardDraft).toHaveBeenCalledWith({ kind: 'deselect-node', nodeId: 'limits' });
    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'editor' });
    expect(canvas.selection().focusReturn).toBeNull();
  });

  test('closing the selected Node deselects it and returns focus to it', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
    });
    await canvas.act((selection) => selection.selectNode('limits'));

    await canvas.act((selection) => selection.closeSelectedNode());

    expect(canvas.selection().selectedNodeId).toBeNull();
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
    expect(canvas.selection().focusReturn).toMatchObject({ destination: 'node' });
  });

  test('closing the student detail deselects the Node', async () => {
    const canvas = renderNodeSelection({ experience: student, nodes: [accessibleNode('limits')] });
    await canvas.act((selection) => selection.selectNode('limits'));

    await canvas.act((selection) => selection.closeSelectedNode());

    expect(canvas.selection().selectedNodeId).toBeNull();
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
    expect(canvas.selection().focusReturn).toMatchObject({ destination: 'node' });
  });

  test('a Node information preview replaces the editor until it closes', async () => {
    const limits = accessibleNode('limits');
    const returnFocus = vi.fn();
    const canvas = renderNodeSelection({ experience: editableTeaching, nodes: [limits] });
    await canvas.act((selection) => selection.selectNode('limits'));

    await canvas.act((selection) =>
      selection.showNodeInformationPreview(limits as StudentAccessibleRoadmapNode, returnFocus),
    );
    expect(canvas.selection().panel).toMatchObject({
      kind: 'node-information-preview',
      node: limits,
      isCompleted: false,
    });

    await canvas.act((selection) => selection.completeNodeInformationPreview());
    expect(canvas.selection().panel).toMatchObject({
      kind: 'node-information-preview',
      isCompleted: true,
    });

    await canvas.act((selection) => selection.closeNodeInformationPreview());
    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'editor' });
    expect(canvas.selection().focusReturn).toEqual({
      token: expect.any(String),
      destination: 'node-information-preview-opener',
      returnFocus,
    });
    expect(returnFocus).not.toHaveBeenCalled();
  });

  test('each closed Node information preview asks again for focus on its opener', async () => {
    const limits = accessibleNode('limits');
    const canvas = renderNodeSelection({ experience: editableTeaching, nodes: [limits] });
    await canvas.act((selection) => selection.selectNode('limits'));
    const openPreview = () =>
      canvas.act((selection) =>
        selection.showNodeInformationPreview(limits as StudentAccessibleRoadmapNode, vi.fn()),
      );

    await openPreview();
    await canvas.act((selection) => selection.closeNodeInformationPreview());
    const first = canvas.selection().focusReturn;
    await openPreview();
    await canvas.act((selection) => selection.dismissTopmostPanel());

    expect(canvas.selection().focusReturn).toMatchObject({
      destination: 'node-information-preview-opener',
    });
    expect(canvas.selection().focusReturn?.token).not.toBe(first?.token);
  });

  test('dismissing closes the Node information preview before the editor', async () => {
    const limits = accessibleNode('limits');
    const canvas = renderNodeSelection({ experience: editableTeaching, nodes: [limits] });
    await canvas.act((selection) => selection.selectNode('limits'));
    await canvas.act((selection) =>
      selection.showNodeInformationPreview(limits as StudentAccessibleRoadmapNode, vi.fn()),
    );

    let dismissed: boolean | undefined;
    await canvas.act((selection) => (dismissed = selection.dismissTopmostPanel()));
    expect(dismissed).toBe(true);
    expect(canvas.selection().panel).toEqual({ kind: 'editor' });

    await canvas.act((selection) => (dismissed = selection.dismissTopmostPanel()));
    expect(dismissed).toBe(true);
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
    expect(canvas.selection().selectedNodeId).toBe('limits');

    await canvas.act((selection) => (dismissed = selection.dismissTopmostPanel()));
    expect(dismissed).toBe(false);
  });

  test('dismissing leaves the student detail to its own close control', async () => {
    const canvas = renderNodeSelection({ experience: student, nodes: [accessibleNode('limits')] });
    await canvas.act((selection) => selection.selectNode('limits'));

    let dismissed: boolean | undefined;
    await canvas.act((selection) => (dismissed = selection.dismissTopmostPanel()));

    expect(dismissed).toBe(false);
    expect(canvas.selection().panel).toEqual({ kind: 'student-detail' });
  });

  test('a selected Node removed by another change is cleared with a notice and focus on the canvas', async () => {
    const canvas = renderNodeSelection({
      experience: student,
      nodes: [accessibleNode('limits'), accessibleNode('derivatives')],
    });
    await canvas.act((selection) => selection.selectNode('limits'));

    canvas.changeNodes([accessibleNode('derivatives')]);

    expect(canvas.selection().selectedNodeId).toBeNull();
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
    expect(canvas.selection().notice).toBe('selected-node-removed');
    expect(canvas.selection().focusReturn).toMatchObject({ destination: 'canvas' });
  });

  test('a selected Node blocked by another change closes its detail with a notice and keeps focus on it', async () => {
    const canvas = renderNodeSelection({ experience: student, nodes: [accessibleNode('limits')] });
    await canvas.act((selection) => selection.selectNode('limits'));

    canvas.changeNodes([blockedNode('limits')]);

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
    expect(canvas.selection().notice).toBe('selected-node-blocked');
    expect(canvas.selection().focusReturn).toMatchObject({ destination: 'node' });
  });

  test('a selected Node blocked after its detail closed stays selected without a notice', async () => {
    const canvas = renderNodeSelection({ experience: student, nodes: [accessibleNode('limits')] });
    await canvas.act((selection) => selection.selectNode('limits'));
    canvas.changeNodes([blockedNode('limits')]);
    await canvas.act((selection) => selection.dismissNotice());

    canvas.changeNodes([blockedNode('limits'), accessibleNode('derivatives')]);

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().notice).toBeNull();
  });

  test('the editor is kept when the selected Node is removed while a draft exists', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
      hasDraft: () => true,
    });
    await canvas.act((selection) => selection.selectNode('limits'));

    canvas.changeNodes([]);

    expect(canvas.selection().selectedNodeId).toBeNull();
    expect(canvas.selection().panel).toEqual({ kind: 'editor' });
    expect(canvas.selection().notice).toBe('selected-node-removed');
  });

  test('the editor closes when the selected Node is removed without a draft', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
    });
    await canvas.act((selection) => selection.selectNode('limits'));

    canvas.changeNodes([]);

    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
  });

  test('selecting another Node dismisses the selection notice', async () => {
    const canvas = renderNodeSelection({
      experience: student,
      nodes: [accessibleNode('limits'), accessibleNode('derivatives')],
    });
    await canvas.act((selection) => selection.selectNode('limits'));
    canvas.changeNodes([accessibleNode('derivatives')]);

    await canvas.act((selection) => selection.selectNode('derivatives'));

    expect(canvas.selection().notice).toBeNull();
  });

  test('a created Node becomes selected without changing the panel', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('created')],
    });

    await canvas.act((selection) => selection.followAppliedCommand(addNodeCommand, 'created'));

    expect(canvas.selection().selectedNodeId).toBe('created');
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
  });

  test('deleting the selected Node closes it and returns focus', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
    });
    await canvas.act((selection) => selection.selectNode('limits'));

    await canvas.act((selection) =>
      selection.followAppliedCommand({ kind: 'delete-node', nodeId: 'limits' }),
    );

    expect(canvas.selection().selectedNodeId).toBeNull();
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
    expect(canvas.selection().focusReturn).toMatchObject({ destination: 'node' });
  });

  test('opening the Resource composer selects the Node and opens the editor on it', async () => {
    const guardDraft = vi.fn(() => Promise.resolve(true));
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
      guardDraft,
    });

    await canvas.act((selection) => selection.openResourceComposer('limits'));

    expect(guardDraft).toHaveBeenCalledWith({ kind: 'open-resource', nodeId: 'limits' });
    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toMatchObject({
      kind: 'editor',
      resourceComposerCommand: { kind: 'open-resource', nodeId: 'limits', mode: 'file' },
    });
  });

  test('the draft guard can refuse opening the Resource composer', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
      guardDraft: () => Promise.resolve(false),
    });

    await canvas.act((selection) => selection.openResourceComposer('limits'));

    expect(canvas.selection().selectedNodeId).toBeNull();
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
  });

  test('a created Node can open in the editor to reveal its Resources', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('created')],
    });
    await canvas.act((selection) => selection.followAppliedCommand(addNodeCommand, 'created'));

    await canvas.act((selection) => selection.openEditor('created'));

    expect(canvas.selection().selectedNodeId).toBe('created');
    expect(canvas.selection().panel).toEqual({ kind: 'editor' });
    expect(canvas.reportPracticeAction).not.toHaveBeenCalled();
  });

  test('selecting a Node is reported to the Practice roadmap', async () => {
    const canvas = renderNodeSelection({ experience: student, nodes: [accessibleNode('limits')] });

    await canvas.act((selection) => selection.selectNode('limits'));

    expect(canvas.reportPracticeAction).toHaveBeenCalledWith({
      type: 'selectNode',
      nodeId: 'limits',
    });
  });

  test('entering Canvas preview starts with no Node selected and no panel open', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
    });
    await canvas.act((selection) => selection.selectNode('limits'));

    canvas.enterCanvasPreview();

    expect(canvas.selection().selectedNodeId).toBeNull();
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
  });

  test('selecting a Node inside Canvas preview opens its student detail', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits')],
    });
    canvas.enterCanvasPreview();

    await canvas.act((selection) => selection.selectNode('limits'));

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'student-detail' });
  });

  test('leaving Canvas preview restores the selected Node and its editor', async () => {
    const canvas = renderNodeSelection({
      experience: editableTeaching,
      nodes: [accessibleNode('limits'), accessibleNode('derivatives')],
    });
    await canvas.act((selection) => selection.selectNode('limits'));
    canvas.enterCanvasPreview();
    await canvas.act((selection) => selection.selectNode('derivatives'));

    canvas.exitCanvasPreview();

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'editor' });
  });

  test('leaving Canvas preview restores a selection that had no panel open', async () => {
    const canvas = renderNodeSelection({
      experience: readOnlyTeaching,
      nodes: [accessibleNode('limits')],
    });
    await canvas.act((selection) => selection.selectNode('limits'));
    canvas.enterCanvasPreview();

    canvas.exitCanvasPreview();

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
  });

  test('leaving Canvas preview entered from a Node information preview restores the selection with the panel closed', async () => {
    const limits = accessibleNode('limits');
    const canvas = renderNodeSelection({ experience: editableTeaching, nodes: [limits] });
    await canvas.act((selection) => selection.selectNode('limits'));
    await canvas.act((selection) =>
      selection.showNodeInformationPreview(limits as StudentAccessibleRoadmapNode, vi.fn()),
    );
    canvas.enterCanvasPreview();

    canvas.exitCanvasPreview();

    expect(canvas.selection().selectedNodeId).toBe('limits');
    expect(canvas.selection().panel).toEqual({ kind: 'closed' });
  });
});
