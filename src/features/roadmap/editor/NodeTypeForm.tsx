import { Check, Plus, Save } from 'lucide-react';
import type { Ref } from 'react';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import {
  nodeTypeColorPalette,
  nodeTypeIcons,
  teachingIconCatalog,
  type NodeTypeColor,
  type NodeTypeIconId,
} from '@/features/roadmap/node-type-appearance';
import { Button } from '@/shared/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
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
  isPending?: boolean;
  nameError?: string;
  hasChanges?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  reservedIcons?: readonly NodeTypeIconId[];
};

function IconPicker({
  value,
  onChange,
  reservedIcons = [],
}: Pick<Props, 'value' | 'onChange' | 'reservedIcons'>) {
  const selectedIcon = value.icon ? nodeTypeIcons.find(({ id }) => id === value.icon) : undefined;

  return (
    <PopoverSwatchPicker
      id="node-type-icon"
      ariaLabel={`Icono: ${selectedIcon?.label ?? 'sin selección'}`}
      title="Elegir icono"
      selection={
        <>
          {value.icon ? (
            <NodeTypeIcon icon={value.icon} data-icon="inline-start" aria-hidden="true" />
          ) : null}
          {selectedIcon?.label ?? 'Elegir icono'}
        </>
      }
      contentClassName="w-80 max-w-[calc(100vw-2rem)] p-3"
      gridClassName="grid grid-cols-[repeat(auto-fit,minmax(2rem,1fr))] gap-1"
      swatchClassName="flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      sections={teachingIconCatalog.map((category) => ({
        label: category.label,
        swatches: category.icons
          .filter(([icon]) => !reservedIcons.includes(icon))
          .map(([icon, label]) => ({
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
      contentClassName="w-auto p-3"
      gridClassName="grid w-fit grid-cols-4 gap-2"
      swatchClassName="flex size-11 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2"
      sections={[
        {
          swatches: nodeTypeColorPalette.map(({ value: color, label }) => ({
            value: color as NodeTypeColor,
            label,
            style: { backgroundColor: color },
            content:
              value.color === color ? (
                <Check className="rounded-full bg-white text-ink" aria-hidden="true" />
              ) : null,
          })),
        },
      ]}
      value={value.color}
      onSelect={(color) => onChange({ ...value, color })}
    />
  );
}

export function NodeTypeForm({
  value,
  isEditing = false,
  onChange,
  onSubmit,
  onCancel,
  isPending = false,
  nameError,
  hasChanges = true,
  inputRef,
  reservedIcons,
}: Props) {
  const canSubmit = Boolean(
    value.name.trim() && value.icon && value.color && !nameError && hasChanges,
  );
  const missingFields = [
    !value.name.trim() && 'un nombre',
    !value.icon && 'un icono',
    !value.color && 'un color',
  ].filter(Boolean);

  return (
    <TooltipProvider delay={600} timeout={0}>
      <form
        className="flex flex-col gap-4"
        aria-busy={isPending}
        onSubmit={async (event) => {
          event.preventDefault();
          if (canSubmit && !isPending) await onSubmit();
        }}
      >
        <fieldset disabled={isPending} className="min-w-0">
          <FieldGroup className="gap-4">
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor="node-type-name">Nombre</FieldLabel>
              <Input
                ref={inputRef}
                id="node-type-name"
                className={inputClassName}
                placeholder="Ej. Ejercicio"
                value={value.name}
                onChange={(event) => onChange({ ...value, name: event.target.value })}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'node-type-name-error' : undefined}
                required
              />
              {nameError ? <FieldError id="node-type-name-error">{nameError}</FieldError> : null}
            </Field>
            <FieldGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
              <Field>
                <FieldLabel htmlFor="node-type-icon">Icono</FieldLabel>
                <IconPicker value={value} onChange={onChange} reservedIcons={reservedIcons} />
              </Field>
              <Field>
                <FieldLabel htmlFor="node-type-color">Color</FieldLabel>
                <ColorPicker value={value} onChange={onChange} />
              </Field>
            </FieldGroup>
          </FieldGroup>
        </fieldset>
        <figure
          className="flex flex-col gap-2 rounded-lg bg-cloud p-4"
          aria-label="Vista previa del tipo de nodo"
        >
          <figcaption className="text-sm text-muted-foreground">Así se verá en el mapa</figcaption>
          <div
            className="flex min-h-16 min-w-0 items-center gap-2.5 rounded-lg border-2 px-4 py-3"
            style={{
              borderColor: value.color ?? 'var(--border)',
              backgroundColor: value.color
                ? `color-mix(in srgb, ${value.color} 3%, var(--card))`
                : 'var(--card)',
            }}
          >
            <NodeTypeIcon
              icon={value.icon ?? 'Shapes'}
              size={20}
              color={value.color ?? 'var(--muted-foreground)'}
              className="shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 font-medium wrap-anywhere">Título del nodo</span>
          </div>
          <p className="min-w-0 text-sm font-medium wrap-anywhere">
            {value.name.trim() || 'Nombre del tipo'}
          </p>
        </figure>
        <FieldDescription id="node-type-requirements">
          {missingFields.length > 0
            ? `Elige ${missingFields.length > 1 ? `${missingFields.slice(0, -1).join(', ')} y ${missingFields.at(-1)}` : missingFields[0]} para crear el tipo.`
            : isEditing && !hasChanges
              ? 'No hay cambios por guardar.'
              : 'Nombre, icono y color son obligatorios.'}
        </FieldDescription>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit || isPending}
            aria-describedby="node-type-requirements"
          >
            {isPending ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : isEditing ? (
              <Save data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            {isPending ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear tipo'}
          </Button>
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </TooltipProvider>
  );
}
