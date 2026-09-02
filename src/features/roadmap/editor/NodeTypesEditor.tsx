import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { RoadmapDto } from '@/lib/roadmap-types';
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
import type { NodeTypeInput } from './types';

type Props = {
  nodeTypes: RoadmapDto['nodeTypes'];
  onAdd: (value: NodeTypeInput) => Promise<boolean>;
  onUpdate: (id: string, value: NodeTypeInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

export function NodeTypesEditor({ nodeTypes, onAdd, onUpdate, onDelete }: Props) {
  const [value, setValue] = useState<NodeTypeInput>({ name: '', color: '#024ad8' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<{ id: string; name: string } | null>(null);
  const isEditing = editingId !== null;

  function closeEditor() {
    setValue({ name: '', color: '#024ad8' });
    setEditingId(null);
  }

  return (
    <>
      <div className="rounded-lg border border-dashed border-border bg-cloud/60 p-3">
        <p className="text-sm font-semibold">
          {isEditing ? 'Editar tipo' : 'Crear tipo personalizado'}
        </p>
        <NodeTypeForm
          value={value}
          isEditing={isEditing}
          onChange={setValue}
          onSubmit={async () => {
            const saved = isEditing ? await onUpdate(editingId!, value) : await onAdd(value);
            if (saved) closeEditor();
          }}
          onCancel={isEditing ? closeEditor : undefined}
        />
      </div>
      <ul
        className="mt-3 flex flex-col divide-y divide-border"
        aria-label="Tipos de nodo disponibles"
      >
        {nodeTypes.map((type) => (
          <li key={type.id} className="flex items-center gap-2 py-2.5 text-sm">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: type.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate font-medium">{type.name}</span>
            {type.isPredefined ? (
              <span className="text-xs text-muted-foreground">Base</span>
            ) : (
              <div className="flex shrink-0 gap-0.5">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Editar tipo ${type.name}`}
                  onClick={() => {
                    setEditingId(type.id);
                    setValue({ name: type.name, color: type.color });
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Eliminar tipo ${type.name}`}
                  onClick={() => setPendingDeletion({ id: type.id, name: type.name })}
                >
                  <Trash2 />
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
