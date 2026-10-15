import { describe, expect, it } from 'vitest';
import {
  editorDraftDiscardConfirmation,
  nodeDeletionConfirmation,
  roadmapNodeVisibilityConfirmation,
  roadmapTeacherBlockConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type { NodeEditorGuardReason } from '@/features/roadmap/editor/types';
import type { TeacherBlockPreview } from '@/features/roadmap/types';

const continueText = 'Puedes seguir editando o descartarlo para continuar.';

describe('editorDraftDiscardConfirmation', () => {
  it.each([
    [
      'replace-node',
      `Seleccionar otro Nodo descartará el borrador actual. ${continueText}`,
      'Descartar y continuar',
    ],
    [
      'open-resource',
      `Agregar un recurso a otro nodo reemplazará el borrador actual. ${continueText}`,
      'Descartar y continuar',
    ],
    [
      'deselect-node',
      `Cerrar este Nodo descartará el borrador actual. ${continueText}`,
      'Descartar y continuar',
    ],
    [
      'delete-node',
      `Eliminar este Nodo descartará el borrador actual. ${continueText}`,
      'Descartar y continuar',
    ],
    [
      'enter-canvas-preview',
      'La previsualización muestra únicamente el último estado guardado. Puedes seguir editando o descartar este borrador para continuar.',
      'Descartar y previsualizar',
    ],
  ])('presents the %s guard', (kind, description, label) => {
    expect(editorDraftDiscardConfirmation({ kind } as NodeEditorGuardReason)).toEqual({
      title: 'Descartar cambios sin guardar',
      description,
      intent: 'destructive',
      cancelLabel: 'Seguir editando',
      actions: [{ id: 'discard-draft', label }],
    });
  });
});

describe('roadmapTeacherBlockConfirmation', () => {
  const roadmap = {
    nodes: [{ id: 'n0', title: 'Funciones', nodeTypeId: 't' }],
    nodeTypes: [],
  };
  const preview = (
    mode: TeacherBlockPreview['mode'],
    titles: readonly string[],
    relation: 'DEPENDENT' | 'PREREQUISITE' = 'DEPENDENT',
  ) =>
    ({
      mode,
      version: 'v1',
      nodes: [
        { id: 'n0', title: 'Funciones', relation: 'SELECTED_NODE' },
        ...titles.map((title, index) => ({ id: `n${index + 1}`, title, relation })),
      ],
    }) as unknown as TeacherBlockPreview;

  it.each([
    [
      'blocks a Node without dependents',
      preview('BLOCK', []),
      '¿Bloquear “Funciones”?',
      'Los estudiantes no podrán abrirlo hasta que lo desbloquees.',
      'block-teacher',
      'Bloquear nodo',
    ],
    [
      'names one dependent that is blocked along',
      preview('BLOCK', ['Gráficas']),
      '¿Bloquear “Funciones”?',
      'Los estudiantes no podrán abrirlo hasta que lo desbloquees. “Gráficas”, que depende de él, también quedará bloqueado.',
      'block-teacher',
      'Bloquear nodo',
    ],
    [
      'counts more than three dependents',
      preview('BLOCK', ['A', 'B', 'C', 'D']),
      '¿Bloquear “Funciones”?',
      'Los estudiantes no podrán abrirlo hasta que lo desbloquees. Los 4 nodos que dependen de él también quedarán bloqueados.',
      'block-teacher',
      'Bloquear nodo',
    ],
    [
      'names the blocked prerequisites an upstream unlock carries',
      preview('UPSTREAM', ['Conjuntos', 'Números'], 'PREREQUISITE'),
      '¿Desbloquear “Funciones”?',
      'Para que los estudiantes puedan abrirlo, también se desbloquearán sus prerrequisitos bloqueados: “Conjuntos” y “Números”.',
      'unlock-prerequisites',
      'Desbloquear 3 nodos',
    ],
    [
      'unlocks a single Node',
      preview('SINGLE', []),
      '¿Desbloquear “Funciones”?',
      'Los estudiantes podrán abrirlo cuando completen sus prerrequisitos.',
      'unlock-node',
      'Desbloquear nodo',
    ],
    [
      'unlocks a Node with its dependents',
      preview('BRANCH', ['Gráficas', 'Límites']),
      '¿Desbloquear “Funciones”?',
      'Los estudiantes podrán abrirlo cuando completen sus prerrequisitos. “Gráficas” y “Límites”, que dependen de él, también quedarán desbloqueados.',
      'unlock-branch',
      'Desbloquear nodo',
    ],
  ] as const)('%s', (_, nodePreview, title, description, id, label) => {
    const confirmation = roadmapTeacherBlockConfirmation({
      roadmap,
      nodeId: 'n0',
      preview: nodePreview,
    });
    expect(confirmation).toEqual({
      title,
      description,
      intent: 'warning',
      actions: [{ id, label }],
    });
  });

  it('offers both unlock scopes when the pair is complete', () => {
    const confirmation = roadmapTeacherBlockConfirmation({
      roadmap,
      nodeId: 'n0',
      preview: preview('SINGLE', []),
      individualPreview: preview('SINGLE', []),
      branchPreview: preview('BRANCH', ['Gráficas']),
    });
    expect(confirmation).toEqual({
      title: '¿Desbloquear “Funciones”?',
      description:
        'Los estudiantes podrán abrirlo cuando completen sus prerrequisitos. “Gráficas”, que depende de él, sigue bloqueado: puedes desbloquear solo este nodo o también sus dependientes.',
      intent: 'warning',
      actions: [
        { id: 'unlock-node', label: 'Solo este nodo' },
        { id: 'unlock-branch', label: 'Incluir dependientes' },
      ],
    });
  });
});

describe('nodeDeletionConfirmation', () => {
  const node = { title: 'Funciones', nodeType: { name: 'Clase', icon: 'Book', color: '#000' } };

  it('states the resources and connections it deletes', () => {
    const confirmation = nodeDeletionConfirmation({
      node,
      resources: [{ id: 'r1' }, { id: 'r2' }],
      dependencies: [
        { sourceTitle: 'Conjuntos', targetTitle: 'Funciones' },
        { sourceTitle: 'Funciones', targetTitle: 'Gráficas' },
      ],
    });
    expect(confirmation.description).toBe(
      'También se eliminarán sus 2 recursos y sus conexiones con “Conjuntos” y “Gráficas”. Esta acción no se puede deshacer.',
    );
    expect(confirmation.actions).toEqual([{ id: 'delete-node', label: 'Eliminar nodo' }]);
  });

  it('keeps only the irreversibility warning for an isolated Node', () => {
    expect(nodeDeletionConfirmation({ node, resources: [], dependencies: [] }).description).toBe(
      'Esta acción no se puede deshacer.',
    );
  });
});

describe('roadmapNodeVisibilityConfirmation', () => {
  const roadmap = {
    nodes: [
      { id: 'a', title: 'Conjuntos', nodeTypeId: 't' },
      { id: 'b', title: 'Funciones', nodeTypeId: 't', isTeacherBlocked: true },
      { id: 'c', title: 'Gráficas', nodeTypeId: 't' },
    ],
    nodeTypes: [],
  };

  it('names the connections hiding removes', () => {
    const confirmation = roadmapNodeVisibilityConfirmation(roadmap, roadmap.nodes[1], true, [
      { id: 'd1', sourceNodeId: 'a', targetNodeId: 'b' },
      { id: 'd2', sourceNodeId: 'b', targetNodeId: 'c' },
    ]);
    expect(confirmation).toEqual({
      title: '¿Ocultar “Funciones”?',
      description:
        'Dejará de aparecer en el roadmap de los estudiantes. Además, se quitará su bloqueo docente y se eliminarán sus conexiones con “Conjuntos” y “Gráficas”; al volver a mostrarlo, tendrás que conectarlo de nuevo.',
      intent: 'destructive',
      actions: [{ id: 'toggle-visibility', label: 'Ocultar' }],
    });
  });

  it('explains how a hidden Node returns', () => {
    expect(roadmapNodeVisibilityConfirmation(roadmap, roadmap.nodes[0], false, [])).toEqual({
      title: '¿Mostrar “Conjuntos”?',
      description:
        'Los estudiantes podrán verlo y abrirlo de inmediato. Aparecerá sin conexiones ni bloqueo docente.',
      intent: 'default',
      actions: [{ id: 'toggle-visibility', label: 'Mostrar' }],
    });
  });
});
