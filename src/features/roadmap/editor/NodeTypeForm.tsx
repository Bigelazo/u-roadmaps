import { Plus, Save } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
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
        {onCancel ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
