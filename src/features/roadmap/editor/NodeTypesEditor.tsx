import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type { RoadmapDto } from '@/features/roadmap/types';
import type { NodeTypeColor, NodeTypeIconId } from '@/features/roadmap/node-type-appearance';
import { Button } from '@/shared/ui/button';
import { NodeTypeForm } from './NodeTypeForm';
import type { NodeTypeDraft, NodeTypeInput } from './types';

const sectionTitleClassName = 'font-heading text-lg leading-tight font-semibold';

type Props = {
  nodeTypes: RoadmapDto['nodeTypes'];
  onAdd: (value: NodeTypeInput) => Promise<boolean>;
  onUpdate: (id: string, value: NodeTypeInput) => Promise<boolean>;
  onRequestDelete: (nodeType: RoadmapDto['nodeTypes'][number]) => void;
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

export function NodeTypesEditor({ nodeTypes, onAdd, onUpdate, onRequestDelete }: Props) {
  const [value, setValue] = useState<NodeTypeDraft>({ name: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = editingId !== null;

  function closeEditor() {
    setValue({ name: '' });
    setEditingId(null);
  }

  return (
    <div className="flex max-h-[min(70dvh,42rem)] flex-col gap-5 overflow-y-auto pr-1">
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

      <section className="flex flex-col gap-1">
        <h2 className={sectionTitleClassName}>Tipos disponibles</h2>
        <ul className="flex flex-col divide-y divide-border" aria-label="Tipos de nodo disponibles">
          {nodeTypes.map((type) => (
            <li key={type.id} className="flex min-h-12 items-center gap-3 text-sm">
              <NodeTypeListIcon type={type} />
              <span className="min-w-0 flex-1 truncate font-medium">{type.name}</span>
              {type.isPredefined ? (
                <span className="text-xs text-muted-foreground">Base</span>
              ) : (
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-11! min-h-11! p-0!"
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
                    size="icon"
                    variant="ghost"
                    className="size-11! min-h-11! p-0!"
                    aria-label={`Eliminar tipo ${type.name}`}
                    onClick={() => onRequestDelete(type)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
