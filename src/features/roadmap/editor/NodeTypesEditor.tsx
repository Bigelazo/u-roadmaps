import { ChevronDown, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { RoadmapDto } from '@/lib/roadmap-types';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { inputClassName } from './primitives';
import type { NodeTypeInput } from './types';

type Props = {
  nodeTypes: RoadmapDto['nodeTypes'];
  value: NodeTypeInput;
  editingId: string | null;
  onChange: (value: NodeTypeInput) => void;
  onStartEditing: (id: string, value: NodeTypeInput) => void;
  onCloseEditor: () => void;
  onAdd: (value: NodeTypeInput) => Promise<boolean>;
  onUpdate: (id: string, value: NodeTypeInput) => Promise<boolean>;
  onDelete: (id: string, name: string) => void;
};

export function NodeTypesEditor({
  nodeTypes,
  value,
  editingId,
  onChange,
  onStartEditing,
  onCloseEditor,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isEditing = Boolean(editingId);

  return (
    <details
      className="group overflow-hidden rounded-xl border border-border bg-background"
      open={isExpanded}
      onToggle={(event) => setIsExpanded(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 marker:content-none hover:bg-cloud/60">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-heading text-base font-semibold">Tipos de nodo</span>
          <span className="text-sm text-muted-foreground">
            {nodeTypes.length} disponibles · administra la leyenda
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">
        <form
          className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-cloud/60 p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              value.name.trim() &&
              (isEditing ? await onUpdate(editingId!, value) : await onAdd(value))
            )
              onCloseEditor();
          }}
        >
          <p className="text-sm font-semibold">
            {isEditing ? 'Editar tipo' : 'Crear tipo personalizado'}
          </p>
          <FieldGroup className="gap-3">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field>
                <FieldLabel htmlFor="node-type-name">Nombre</FieldLabel>
                <Input
                  id="node-type-name"
                  className={inputClassName}
                  placeholder="Ej. Ejercicio"
                  value={value.name}
                  onChange={(event) => onChange({ ...value, name: event.target.value })}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="node-type-color">Color</FieldLabel>
                <Input
                  id="node-type-color"
                  className="h-11 w-13 cursor-pointer p-1"
                  type="color"
                  value={value.color}
                  onChange={(event) => onChange({ ...value, color: event.target.value })}
                  required
                />
              </Field>
            </div>
          </FieldGroup>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {isEditing ? <Save data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {isEditing ? 'Guardar tipo' : 'Crear tipo'}
            </Button>
            {isEditing && (
              <Button type="button" variant="outline" size="sm" onClick={onCloseEditor}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
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
                      setIsExpanded(true);
                      onStartEditing(type.id, { name: type.name, color: type.color });
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Eliminar tipo ${type.name}`}
                    onClick={() => onDelete(type.id, type.name)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
