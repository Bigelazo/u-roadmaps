import { Eye, EyeOff, FilePlusCorner, LockKeyhole, LockKeyholeOpen, Trash2 } from 'lucide-react';
import type { NodeActionCallbacks } from '@/features/roadmap/graph/node-action';

export const nodeActionMenuCloseDurationMs = 160;

export function nodeMenuActions(
  nodeId: string,
  hidden: boolean,
  teacherBlocked: boolean,
  onAction: NodeActionCallbacks['onAction'],
) {
  const accessLabel = teacherBlocked ? 'Desbloquear' : 'Bloquear nodo';
  const visibilityLabel = hidden ? 'Mostrar para estudiantes' : 'Ocultar para estudiantes';
  return [
    ...(!hidden
      ? [
          {
            id: 'access',
            label: accessLabel,
            Icon: teacherBlocked ? LockKeyholeOpen : LockKeyhole,
            RestIcon: teacherBlocked ? LockKeyhole : LockKeyholeOpen,
            onSelect: () =>
              onAction?.({
                kind: 'change-teacher-block',
                nodeId,
                operation: teacherBlocked ? 'UNBLOCK' : 'BLOCK',
              }),
            angle: 0,
          },
        ]
      : []),
    {
      id: 'visibility',
      label: visibilityLabel,
      Icon: hidden ? Eye : EyeOff,
      RestIcon: hidden ? EyeOff : Eye,
      onSelect: () => onAction?.({ kind: hidden ? 'show-node' : 'hide-node', nodeId }),
      angle: 30,
    },
    {
      id: 'resource',
      label: 'Agregar recurso',
      Icon: FilePlusCorner,
      RestIcon: null,
      onSelect: () => onAction?.({ kind: 'add-resource', nodeId }),
      angle: 60,
    },
    {
      id: 'delete',
      label: 'Eliminar nodo',
      Icon: Trash2,
      RestIcon: null,
      onSelect: () => onAction?.({ kind: 'delete-node', nodeId }),
      angle: 90,
    },
  ];
}
