import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { canvasConfirmation } from '@/features/roadmap/canvas/commands/use-canvas-commands';
import {
  editorDraftDiscardConfirmation,
  nodeDeletionConfirmation,
  roadmapNodeVisibilityConfirmation,
  roadmapTeacherBlockConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type { NodeEditorGuardReason } from '@/features/roadmap/editor/types';
import type { NodeType, TeacherBlockOperationImpact } from '@/features/roadmap/types';
import type { ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

function text(value: ConfirmationPresentation['title'] | undefined) {
  return renderToStaticMarkup(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function plain(confirmation: ConfirmationPresentation | null) {
  return confirmation
    ? {
        ...confirmation,
        title: text(confirmation.title),
        description: text(confirmation.description),
      }
    : null;
}

describe('editorDraftDiscardConfirmation', () => {
  it.each([
    [
      'replace-node',
      'Seleccionar otro nodo descartará el borrador actual.',
      'Descartar y continuar',
    ],
    [
      'open-resource',
      'Agregar un recurso a otro nodo descartará el borrador actual.',
      'Descartar y continuar',
    ],
    ['deselect-node', 'Cerrar este nodo descartará el borrador actual.', 'Descartar y continuar'],
    ['delete-node', 'Eliminar este nodo descartará el borrador actual.', 'Descartar y continuar'],
    [
      'enter-canvas-preview',
      'La previsualización muestra solo lo guardado, así que se descartará el borrador actual.',
      'Descartar y previsualizar',
    ],
  ])('presents the %s guard', (kind, description, label) => {
    expect(editorDraftDiscardConfirmation({ kind } as NodeEditorGuardReason)).toEqual({
      title: '¿Descartar los cambios sin guardar?',
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
    nodeTypes: [
      {
        id: 't',
        name: 'Clase',
        icon: 'BookOpen',
        color: '#024AD8',
        isPredefined: true,
      } as NodeType,
    ],
  };
  const preview = (
    mode: TeacherBlockOperationImpact['mode'],
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
    }) as unknown as TeacherBlockOperationImpact;
  const schedule = (isScheduling: boolean, unlockAt: Date | null = null) => ({
    isScheduling,
    unlockAt,
    onSchedulingChange: () => {},
    onUnlockAtChange: () => {},
  });

  it.each([
    [
      'blocks a Node without dependents',
      preview('BLOCK', []),
      'Los estudiantes no podrán abrirlo hasta que lo desbloquees.',
    ],
    [
      'stresses the one dependent blocked along',
      preview('BLOCK', ['Gráficas']),
      'Los estudiantes no podrán abrirlo hasta que lo desbloquees. También se bloqueará el nodo que depende de él.',
    ],
    [
      'counts the dependents blocked along instead of listing them',
      preview('BLOCK', ['A', 'B', 'C', 'D']),
      'Los estudiantes no podrán abrirlo hasta que lo desbloquees. También se bloquearán los 4 nodos que dependen de él.',
    ],
  ] as const)('%s as a danger action', (_, nodePreview, description) => {
    const confirmation = roadmapTeacherBlockConfirmation({
      roadmap,
      nodeId: 'n0',
      preview: nodePreview,
    });
    expect(plain(confirmation)).toEqual({
      title: '¿Bloquear Funciones?',
      description,
      intent: 'destructive',
      actions: [{ id: 'block-teacher', label: 'Bloquear nodo' }],
    });
  });

  it('names the selected Node with its type icon and color, never in quotes', () => {
    const confirmation = roadmapTeacherBlockConfirmation({
      roadmap,
      nodeId: 'n0',
      preview: preview('BLOCK', []),
    });
    const markup = renderToStaticMarkup(confirmation.title);
    expect(markup).toContain('data-slot="node-name"');
    expect(markup).toContain('color:#024AD8');
    expect(markup).not.toMatch(/[“”«»"]Funciones/);
  });

  it.each([
    [
      'counts the blocked prerequisites an upstream unlock carries',
      { preview: preview('UPSTREAM', ['Conjuntos', 'Números'], 'PREREQUISITE') },
      'Para que los estudiantes puedan abrirlo, también se desbloquearán sus 2 prerrequisitos bloqueados.',
      [{ id: 'unlock-prerequisites', label: 'Desbloquear 3 nodos', emphasis: 'primary' }],
    ],
    [
      'names the one blocked prerequisite an upstream unlock carries',
      { preview: preview('UPSTREAM', ['Conjuntos'], 'PREREQUISITE') },
      'Para que los estudiantes puedan abrirlo, también se desbloqueará su prerrequisito bloqueado.',
      [{ id: 'unlock-prerequisites', label: 'Desbloquear 2 nodos', emphasis: 'primary' }],
    ],
    [
      'offers a single verb when no dependent would be released',
      {
        preview: preview('SINGLE', []),
        individualPreview: preview('SINGLE', []),
        branchPreview: preview('BRANCH', []),
      },
      'Los estudiantes podrán abrirlo cuando completen sus prerrequisitos.',
      [{ id: 'unlock-node', label: 'Desbloquear', emphasis: 'primary' }],
    ],
    [
      'offers both scopes with equal emphasis when dependents would be released',
      {
        preview: preview('SINGLE', []),
        individualPreview: preview('SINGLE', []),
        branchPreview: preview('BRANCH', ['Gráficas', 'Límites']),
      },
      'Los estudiantes podrán abrirlo cuando completen sus prerrequisitos. 2 nodos que dependen de él siguen bloqueados.',
      [
        { id: 'unlock-node', label: 'Solo este nodo', emphasis: 'primary' },
        { id: 'unlock-branch', label: 'Incluir dependientes', emphasis: 'primary' },
      ],
    ],
    [
      'counts one releasable dependent',
      {
        preview: preview('SINGLE', []),
        individualPreview: preview('SINGLE', []),
        branchPreview: preview('BRANCH', ['Gráficas']),
      },
      'Los estudiantes podrán abrirlo cuando completen sus prerrequisitos. 1 nodo que depende de él sigue bloqueado.',
      [
        { id: 'unlock-node', label: 'Solo este nodo', emphasis: 'primary' },
        { id: 'unlock-branch', label: 'Incluir dependientes', emphasis: 'primary' },
      ],
    ],
    [
      'unlocks a branch requested on its own',
      { preview: preview('BRANCH', ['Gráficas', 'Límites']) },
      'Los estudiantes podrán abrirlo cuando completen sus prerrequisitos. También se desbloquearán 2 nodos que dependen de él.',
      [{ id: 'unlock-branch', label: 'Desbloquear', emphasis: 'primary' }],
    ],
  ] as const)('%s', (_, previews, description, actions) => {
    const confirmation = roadmapTeacherBlockConfirmation({ roadmap, nodeId: 'n0', ...previews });
    expect(plain(confirmation)).toEqual({
      title: '¿Desbloquear Funciones?',
      description,
      intent: 'default',
      actions,
    });
  });

  it('offers scheduling inside every unlock and relabels the actions while scheduling', () => {
    const pair = {
      roadmap,
      nodeId: 'n0',
      preview: preview('SINGLE', []),
      individualPreview: preview('SINGLE', []),
      branchPreview: preview('BRANCH', ['Gráficas']),
    };
    const idle = roadmapTeacherBlockConfirmation({ ...pair, schedule: schedule(false) });
    expect(renderToStaticMarkup(idle.content)).toContain('Programar desbloqueo');

    expect(renderToStaticMarkup(idle.content)).not.toContain('sigue bloqueado');

    const withoutDate = roadmapTeacherBlockConfirmation({ ...pair, schedule: schedule(true) });
    expect(renderToStaticMarkup(withoutDate.content)).toContain(
      'Si a esa hora algún prerrequisito sigue bloqueado, este nodo no se desbloqueará hasta que se desbloqueen sus prerrequisitos.',
    );
    expect(withoutDate.actions).toEqual([
      { id: 'unlock-node', label: 'Programar este nodo', emphasis: 'primary', disabled: true },
      {
        id: 'unlock-branch',
        label: 'Programar con dependientes',
        emphasis: 'primary',
        disabled: true,
      },
    ]);

    const withDate = roadmapTeacherBlockConfirmation({
      ...pair,
      schedule: schedule(true, new Date('2026-11-08T19:30:00.000Z')),
    });
    expect(withDate.actions.map(({ disabled }) => disabled)).toEqual([undefined, undefined]);

    expect(
      roadmapTeacherBlockConfirmation({
        roadmap,
        nodeId: 'n0',
        preview: preview('UPSTREAM', ['Conjuntos'], 'PREREQUISITE'),
        schedule: schedule(true, new Date('2026-11-08T19:30:00.000Z')),
      }).actions,
    ).toEqual([{ id: 'unlock-prerequisites', label: 'Programar 2 nodos', emphasis: 'primary' }]);
  });

  it('keeps scheduling out of a block', () => {
    expect(
      roadmapTeacherBlockConfirmation({
        roadmap,
        nodeId: 'n0',
        preview: preview('BLOCK', []),
        schedule: schedule(true),
      }).content,
    ).toBeUndefined();
  });
});

describe('nodeDeletionConfirmation', () => {
  const node = { title: 'Funciones', nodeType: { name: 'Clase', icon: 'Book', color: '#000' } };

  it('counts the resources and connections it deletes', () => {
    const confirmation = nodeDeletionConfirmation({
      node,
      resources: [{ id: 'r1' }, { id: 'r2' }],
      dependencies: [
        { sourceTitle: 'Conjuntos', targetTitle: 'Funciones' },
        { sourceTitle: 'Funciones', targetTitle: 'Gráficas' },
      ],
    });
    expect(plain(confirmation)).toEqual({
      title: '¿Eliminar Funciones?',
      description:
        'También se eliminarán sus 2 recursos y sus 2 conexiones. Esta acción no se puede deshacer.',
      intent: 'destructive',
      actions: [{ id: 'delete-node', label: 'Eliminar nodo' }],
    });
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

  it('counts the connections hiding removes', () => {
    const confirmation = roadmapNodeVisibilityConfirmation(roadmap, roadmap.nodes[1], true, [
      { id: 'd1', sourceNodeId: 'a', targetNodeId: 'b' },
      { id: 'd2', sourceNodeId: 'b', targetNodeId: 'c' },
    ]);
    expect(plain(confirmation)).toEqual({
      title: '¿Ocultar Funciones?',
      description:
        'Dejará de aparecer en el roadmap de los estudiantes. Además, se quitará su bloqueo docente y se eliminarán sus 2 conexiones; al volver a mostrarlo, tendrás que conectarlo de nuevo.',
      intent: 'destructive',
      actions: [{ id: 'hide-node', label: 'Ocultar' }],
    });
  });

  it('explains how a hidden Node returns', () => {
    expect(plain(roadmapNodeVisibilityConfirmation(roadmap, roadmap.nodes[0], false, []))).toEqual({
      title: '¿Mostrar Conjuntos?',
      description:
        'Los estudiantes podrán verlo y abrirlo de inmediato. Aparecerá sin conexiones ni bloqueo docente.',
      intent: 'default',
      actions: [{ id: 'show-node', label: 'Mostrar' }],
    });
  });
});

describe('canvasConfirmation', () => {
  const roadmap = {
    nodes: [
      { id: 'a', title: 'Conjuntos', nodeTypeId: 't' },
      { id: 'b', title: 'Funciones', nodeTypeId: 't' },
    ],
    nodeTypes: [
      {
        id: 't',
        name: 'Taller',
        icon: 'Shapes',
        color: '#024AD8',
        isPredefined: false,
      } as NodeType,
    ],
  };
  const deletionImpact = {
    node: { title: 'Funciones', nodeType: { name: 'Clase', icon: 'Book', color: '#000' } },
    dependencies: [{ id: 'd1', sourceTitle: 'Conjuntos', targetTitle: 'Funciones' }],
    resources: [],
    version: 'v1',
  };

  it('shows nothing while the Change impact is being previewed', () => {
    expect(
      canvasConfirmation(
        {
          kind: 'delete-node',
          request: { kind: 'delete-node', nodeId: 'b' },
          impact: null,
          phase: 'reading-impact',
        },
        roadmap,
      ),
    ).toBeNull();
  });

  it('presents hiding with the connections its Change impact removes', () => {
    expect(
      plain(
        canvasConfirmation(
          {
            kind: 'hide-node',
            request: { kind: 'hide-node', nodeId: 'b' },
            impact: {
              dependencies: [{ id: 'd1', sourceNodeId: 'a', targetNodeId: 'b' }],
              version: 'v1',
            },
            phase: 'awaiting',
          },
          roadmap,
        ),
      ),
    ).toMatchObject({
      title: '¿Ocultar Funciones?',
      description: expect.stringContaining('se eliminará su conexión'),
      actions: [{ id: 'hide-node', label: 'Ocultar' }],
    });
  });

  it('presents showing, and keeps presenting a choice while it is being confirmed', () => {
    expect(
      canvasConfirmation(
        {
          kind: 'show-node',
          request: { kind: 'show-node', nodeId: 'a' },
          impact: null,
          phase: 'confirming',
          choice: 'show-node',
        },
        roadmap,
      ),
    ).toMatchObject({ actions: [{ id: 'show-node' }] });
  });

  it('presents a Node deletion from its Change impact', () => {
    const confirmation = canvasConfirmation(
      {
        kind: 'delete-node',
        request: { kind: 'delete-node', nodeId: 'b' },
        impact: deletionImpact,
        phase: 'awaiting',
      },
      roadmap,
    );
    expect(text(confirmation?.title)).toBe('¿Eliminar Funciones?');
    expect(confirmation?.description).toBe(
      'También se eliminará su conexión. Esta acción no se puede deshacer.',
    );
  });

  it('shows nothing for a Node the Roadmap no longer has', () => {
    expect(
      canvasConfirmation(
        {
          kind: 'show-node',
          request: { kind: 'show-node', nodeId: 'missing' },
          impact: null,
          phase: 'awaiting',
        },
        roadmap,
      ),
    ).toBeNull();
  });

  it('offers both unlock scopes from a Teacher block Change impact', () => {
    const scope = (mode: 'SINGLE' | 'BRANCH', ids: readonly string[]) => ({
      mode,
      version: mode,
      nodes: ids.map((id) => ({
        id,
        title: id === 'a' ? 'Conjuntos' : 'Funciones',
        relation: id === 'a' ? ('SELECTED_NODE' as const) : ('DEPENDENT' as const),
      })),
    });
    expect(
      canvasConfirmation(
        {
          kind: 'change-teacher-block',
          request: { kind: 'change-teacher-block', nodeId: 'a', operation: 'UNBLOCK' },
          impact: { UNBLOCK: scope('SINGLE', ['a']), BRANCH_UNLOCK: scope('BRANCH', ['a', 'b']) },
          phase: 'awaiting',
        },
        roadmap,
      ),
    ).toMatchObject({
      actions: [{ id: 'unlock-node' }, { id: 'unlock-branch' }],
    });
  });

  const creation = {
    kind: 'create-dependency',
    sourceNodeId: 'a',
    targetNodeId: 'b',
    sourceHandle: 'right',
    targetHandle: 'left',
  } as const;

  it('presents a Dependency creation with the Nodes it Teacher-blocks', () => {
    expect(
      plain(
        canvasConfirmation(
          {
            kind: 'create-dependency',
            request: creation,
            impact: { nodes: [{ id: 'b', title: 'Funciones' }], version: 'v1' },
            phase: 'awaiting',
          },
          roadmap,
        ),
      ),
    ).toEqual({
      title: '¿Conectar Conjuntos con Funciones?',
      description: 'Como Conjuntos tiene bloqueo docente, la conexión también bloqueará 1 nodo.',
      intent: 'warning',
      actions: [{ id: 'create-dependency', label: 'Conectar y bloquear' }],
    });
  });

  it('shows nothing while a Dependency creation without Change impact applies', () => {
    expect(
      canvasConfirmation(
        {
          kind: 'create-dependency',
          request: creation,
          impact: { nodes: [], version: 'v1' },
          phase: 'confirming',
        },
        roadmap,
      ),
    ).toBeNull();
  });

  it('presents the Dependencies still to delete', () => {
    expect(
      canvasConfirmation(
        {
          kind: 'delete-dependencies',
          request: { kind: 'delete-dependencies', dependencyIds: ['d2'] },
          impact: null,
          phase: 'awaiting',
        },
        roadmap,
      ),
    ).toMatchObject({
      title: '¿Eliminar la dependencia?',
      description: 'Los nodos dejarán de estar conectados. Esta acción no se puede deshacer.',
      actions: [{ id: 'delete-dependencies', label: 'Eliminar' }],
    });
  });

  it('presents an automatic layout', () => {
    expect(
      canvasConfirmation(
        {
          kind: 'apply-automatic-layout',
          request: { kind: 'apply-automatic-layout', positions: [], direction: 'LR' },
          impact: null,
          phase: 'awaiting',
        },
        roadmap,
      ),
    ).toMatchObject({
      title: '¿Ordenar los nodos automáticamente?',
      actions: [{ id: 'auto-layout', label: 'Ordenar nodos' }],
    });
  });

  it('presents a Node type deletion, and nothing for a Node type the Roadmap no longer has', () => {
    const deletion = (nodeTypeId: string) =>
      canvasConfirmation(
        {
          kind: 'delete-node-type',
          request: { kind: 'delete-node-type', nodeTypeId },
          impact: null,
          phase: 'confirming',
          choice: 'delete-node-type',
        },
        roadmap,
      );
    expect(plain(deletion('t'))).toMatchObject({
      title: '¿Eliminar el tipo Taller?',
      description: 'Esta acción no se puede deshacer.',
      actions: [{ id: 'delete-node-type', label: 'Eliminar' }],
    });
    expect(deletion('missing')).toBeNull();
  });

  it('presents a Canvas preview progress reset', () => {
    expect(
      canvasConfirmation(
        {
          kind: 'reset-canvas-preview',
          request: { kind: 'reset-canvas-preview' },
          impact: null,
          phase: 'awaiting',
        },
        roadmap,
      ),
    ).toMatchObject({
      title: '¿Reiniciar el progreso simulado?',
      intent: 'destructive',
      actions: [{ id: 'reset-canvas-preview', label: 'Reiniciar progreso' }],
    });
  });
});
