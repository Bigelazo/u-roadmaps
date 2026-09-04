import { Plus, Save } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import {
  nodeTypeColorPalette,
  defaultCustomNodeTypeIcon,
  teachingIconCatalog,
  type NodeTypeColor,
  type NodeTypeIconId,
} from '@/features/roadmap/node-type-appearance';
import { inputClassName } from './primitives';
import type { NodeTypeInput } from './types';

type Props = {
  value: NodeTypeInput;
  isEditing?: boolean;
  onChange: (value: NodeTypeInput) => void;
  onSubmit: () => Promise<void>;
  onCancel?: () => void;
};

export function NodeTypeForm({ value, isEditing = false, onChange, onSubmit, onCancel }: Props) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (value.name.trim()) await onSubmit();
      }}
    >
      <FieldGroup className="gap-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
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
            <FieldLabel htmlFor="node-type-icon">Ícono</FieldLabel>
            <select
              id="node-type-icon"
              className={`${inputClassName} h-11 max-w-48`}
              value={value.icon}
              onChange={(event) =>
                onChange({ ...value, icon: event.target.value as NodeTypeIconId })
              }
              required
            >
              <option value={defaultCustomNodeTypeIcon.id}>
                {defaultCustomNodeTypeIcon.label}
              </option>
              {teachingIconCatalog.map((category) => (
                <optgroup key={category.label} label={category.label}>
                  {category.icons.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="node-type-color">Color</FieldLabel>
            <select
              id="node-type-color"
              className={`${inputClassName} h-11 max-w-44`}
              value={value.color}
              onChange={(event) =>
                onChange({ ...value, color: event.target.value as NodeTypeColor })
              }
              required
            >
              {nodeTypeColorPalette.map(({ value: color, label }) => (
                <option key={color} value={color}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </FieldGroup>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {isEditing ? <Save data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
          {isEditing ? 'Guardar tipo' : 'Crear tipo'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
