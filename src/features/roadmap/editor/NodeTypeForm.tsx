import { Check, Plus, Save } from 'lucide-react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import {
  nodeTypeColorPalette,
  nodeTypeIcons,
  teachingIconCatalog,
  type NodeTypeColor,
} from '@/features/roadmap/node-type-appearance';
import { Button } from '@/shared/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { PopoverSwatchPicker } from './PopoverSwatchPicker';
import { inputClassName } from './primitives';
import type { NodeTypeDraft } from './types';

type Props = {
  value: NodeTypeDraft;
  isEditing?: boolean;
  onChange: (value: NodeTypeDraft) => void;
  onSubmit: () => Promise<void>;
  onCancel?: () => void;
};

function IconPicker({ value, onChange }: Pick<Props, 'value' | 'onChange'>) {
  const selectedIcon = value.icon ? nodeTypeIcons.find(({ id }) => id === value.icon) : undefined;

  return (
    <PopoverSwatchPicker
      id="node-type-icon"
      ariaLabel={`Icono: ${selectedIcon?.label ?? 'sin selección'}`}
      title="Elegir Icono"
      selection={
        <>
          {value.icon ? (
            <NodeTypeIcon icon={value.icon} data-icon="inline-start" aria-hidden="true" />
          ) : null}
          {selectedIcon?.label ?? 'Elegir Icono'}
        </>
      }
      contentClassName="w-80 p-3"
      gridClassName="grid grid-cols-8 gap-1"
      swatchClassName="flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      sections={teachingIconCatalog.map((category) => ({
        label: category.label,
        swatches: category.icons.map(([icon, label]) => ({
          value: icon,
          label,
          content: <NodeTypeIcon icon={icon} aria-hidden="true" />,
        })),
      }))}
      value={value.icon}
      onSelect={(icon) => onChange({ ...value, icon })}
    />
  );
}

function ColorPicker({ value, onChange }: Pick<Props, 'value' | 'onChange'>) {
  const selectedColor = value.color
    ? nodeTypeColorPalette.find(({ value: color }) => color === value.color)
    : undefined;

  return (
    <PopoverSwatchPicker
      id="node-type-color"
      ariaLabel={`Color: ${selectedColor?.label ?? 'sin selección'}`}
      title="Elegir color"
      selection={
        <>
          {selectedColor ? (
            <span
              className="size-4 shrink-0 rounded-full ring-1 ring-foreground/20"
              style={{ backgroundColor: selectedColor.value }}
              aria-hidden="true"
            />
          ) : null}
          {selectedColor?.label ?? 'Elegir color'}
        </>
      }
      contentClassName="w-72 p-3"
      gridClassName="grid grid-cols-5 gap-2"
      swatchClassName="flex size-10 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2"
      sections={[
        {
          swatches: nodeTypeColorPalette.map(({ value: color, label }) => ({
            value: color as NodeTypeColor,
            label,
            style: { backgroundColor: color },
            content:
              value.color === color ? <Check className="text-white" aria-hidden="true" /> : null,
          })),
        },
      ]}
      value={value.color}
      onSelect={(color) => onChange({ ...value, color })}
    />
  );
}

export function NodeTypeForm({ value, isEditing = false, onChange, onSubmit, onCancel }: Props) {
  const canSubmit = Boolean(value.name.trim() && value.icon && value.color);

  return (
    <TooltipProvider>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (canSubmit) await onSubmit();
        }}
      >
        <FieldGroup className="gap-3">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="node-type-icon">Icono</FieldLabel>
              <IconPicker value={value} onChange={onChange} />
            </Field>
            <Field>
              <FieldLabel htmlFor="node-type-color">Color</FieldLabel>
              <ColorPicker value={value} onChange={onChange} />
            </Field>
          </div>
        </FieldGroup>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!canSubmit}>
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
    </TooltipProvider>
  );
}
