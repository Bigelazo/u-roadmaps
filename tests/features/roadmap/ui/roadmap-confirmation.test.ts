import { describe, expect, it } from 'vitest';
import {
  editorDraftDiscardConfirmation,
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
      intent: 'warning',
      cancelLabel: 'Seguir editando',
      actions: [{ id: 'discard-draft', label }],
    });
  });
});

describe('roadmapTeacherBlockConfirmation', () => {
  const roadmap = { nodes: [], nodeTypes: [] };
  const preview = (mode: TeacherBlockPreview['mode'], count: number) =>
    ({
      mode,
      version: 'v1',
      nodes: Array.from({ length: count }, (_, index) => ({
        id: `n${index}`,
        title: `N${index}`,
        relation: 'DEPENDENT',
      })),
    }) as unknown as TeacherBlockPreview;
  const impact = 'Esta acción puede afectar el acceso y progreso estudiantil.';

  it.each([
    [
      'BLOCK',
      2,
      'Confirmar bloqueo de rama',
      `Bloquearás 2 nodos. ${impact}`,
      'Nodos que se bloquearán',
      'block-teacher',
      'Bloquear rama',
    ],
    [
      'UPSTREAM',
      1,
      'Desbloquear prerrequisitos',
      `Desbloquearás 1 nodo, incluidos los prerrequisitos bloqueados. ${impact}`,
      'Nodos que se desbloquearán',
      'unlock-prerequisites',
      'Desbloquear 1 nodo',
    ],
    [
      'UPSTREAM',
      3,
      'Desbloquear prerrequisitos',
      `Desbloquearás 3 nodos, incluidos los prerrequisitos bloqueados. ${impact}`,
      'Nodos que se desbloquearán',
      'unlock-prerequisites',
      'Desbloquear 3 nodos',
    ],
    [
      'SINGLE',
      1,
      'Confirmar desbloqueo',
      `Desbloquearás 1 nodo. ${impact}`,
      'Nodos que se desbloquearán',
      'unlock-node',
      'Desbloquear este Nodo',
    ],
    [
      'BRANCH',
      0,
      'Confirmar desbloqueo de rama',
      `Desbloquearás 0 nodos elegibles de la rama. ${impact}`,
      'Nodos que se desbloquearán',
      'unlock-branch',
      'Desbloquear la rama',
    ],
  ] as const)(
    'presents %s with %i nodes',
    (mode, count, title, description, sectionTitle, id, label) => {
      const confirmation = roadmapTeacherBlockConfirmation({
        roadmap,
        nodeId: 'n0',
        preview: preview(mode, count),
      });
      expect(confirmation).toMatchObject({
        title,
        description,
        intent: 'warning',
        actions: [{ id, label }],
      });
      expect(confirmation.actions).toHaveLength(1);
      expect(confirmation.sections).toHaveLength(1);
      expect(confirmation.sections?.[0]).toMatchObject({
        title: sectionTitle,
        emptyMessage: 'No hay Nodos afectados.',
      });
      expect(confirmation.sections?.[0]?.items).toHaveLength(count);
    },
  );

  it('offers both unlock scopes when the pair is complete', () => {
    const confirmation = roadmapTeacherBlockConfirmation({
      roadmap,
      nodeId: 'n0',
      preview: preview('SINGLE', 1),
      individualPreview: preview('SINGLE', 1),
      branchPreview: preview('BRANCH', 2),
    });
    expect(confirmation).toMatchObject({
      title: 'Confirmar desbloqueo',
      description:
        'Elige el alcance del desbloqueo. Ambas opciones pueden afectar el acceso y progreso estudiantil.',
      intent: 'warning',
      actions: [
        { id: 'unlock-node', label: 'Desbloquear este Nodo' },
        { id: 'unlock-branch', label: 'Desbloquear la rama' },
      ],
    });
    expect(confirmation.sections?.map((section) => section.title)).toEqual([
      'Solo este Nodo',
      'Este Nodo y su rama',
    ]);
  });
});
