import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type { RoadmapDto } from '@/features/roadmap/types';
import type { NodeTypeColor, NodeTypeIconId } from '@/features/roadmap/node-type-appearance';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { NodeTypeForm } from './NodeTypeForm';
import type { NodeTypeDraft, NodeTypeInput } from './types';
import { DialogTitle } from '@/shared/ui/dialog';

const sectionTitleClassName = 'font-heading text-lg leading-tight font-semibold tracking-[-0.015em]';

type Props = {
  nodeTypes: RoadmapDto['nodeTypes'];
  onAdd: (value: NodeTypeInput) => Promise<boolean>;
  onUpdate: (id: string, value: NodeTypeInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

function NodeTypeListIcon({ type }: { type: RoadmapDto['nodeTypes'][number] }) {
  return (
    <NodeTypeIcon
      icon={type.icon}
      className="size-4 shrink-0"
      style={{ color: type.color }}
      aria-hidden="true"
    />
  );
}

export function NodeTypesEditor({ nodeTypes, onAdd, onUpdate, onDelete }: Props) {
  const [value, setValue] = useState<NodeTypeDraft>({ name: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<{ id: string; name: string } | null>(null);
  const isEditing = editingId !== null;

  function closeEditor() {
    setValue({ name: '' });
    setEditingId(null);
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className={sectionTitleClassName}>
          {isEditing ? 'Editar tipo' : 'Crear tipo personalizado'}
        </h2>
        <NodeTypeForm
          value={value}
          isEditing={isEditing}
          onChange={setValue}
          onSubmit={async () => {
            if (!value.icon || !value.color) return;
            const nodeType: NodeTypeInput = {
              name: value.name,
              icon: value.icon,
              color: value.color,
            };
            const saved = isEditing ? await onUpdate(editingId!, nodeType) : await onAdd(nodeType);
            if (saved) closeEditor();
          }}
          onCancel={isEditing ? closeEditor : undefined}
        />
      </section>
      <DialogTitle className={sectionTitleClassName}>Tipos de nodo</DialogTitle>

      <ul
        className="mt-1 flex flex-col divide-y divide-border"
        aria-label="Tipos de nodo disponibles"
      >
        {nodeTypes.map((type) => (
          <li key={type.id} className="flex h-11 items-center gap-2 text-sm">
            <NodeTypeListIcon type={type} />
            <span className="min-w-0 flex-1 truncate font-medium">{type.name}</span>
            {type.isPredefined ? (
              <span className="text-xs text-muted-foreground">Base</span>
            ) : (
              <div className="flex shrink-0 gap-0.5">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="!size-8 !min-h-0 !p-0"
                  aria-label={`Editar tipo ${type.name}`}
                  onClick={() => {
                    setEditingId(type.id);
                    setValue({
                      name: type.name,
                      icon: type.icon as NodeTypeIconId,
                      color: type.color as NodeTypeColor,
                    });
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="!size-8 !min-h-0 !p-0"
                  aria-label={`Eliminar tipo ${type.name}`}
                  onClick={() => setPendingDeletion({ id: type.id, name: type.name })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <AlertDialog
        open={pendingDeletion !== null}
        onOpenChange={(open) => !open && setPendingDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">
              Confirmar eliminación
            </AlertDialogTitle>
            <AlertDialogDescription>
              Eliminarás el tipo {pendingDeletion?.name}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() => {
                if (!pendingDeletion) return;
                void onDelete(pendingDeletion.id).then((deleted) => {
                  if (deleted) setPendingDeletion(null);
                });
              }}
            >
              <Trash2 data-icon="inline-start" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
