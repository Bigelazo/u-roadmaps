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
import { ScrollArea } from '@/shared/ui/scroll-area';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { PopoverSwatchPicker, Swatch } from './PopoverSwatchPicker';
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
      contentClassName="w-80 p-3"
      selection={
        <>
          {value.icon ? (
            <NodeTypeIcon icon={value.icon} data-icon="inline-start" aria-hidden="true" />
          ) : null}
          {selectedIcon?.label ?? 'Elegir Icono'}
        </>
      }
    >
      {(close) => (
        <ScrollArea className="h-80">
          <div className="flex flex-col gap-4 pr-2">
            {teachingIconCatalog.map((category) => (
              <section key={category.label} aria-label={category.label}>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                  {category.label}
                </h3>
                <div className="grid grid-cols-8 gap-1">
                  {category.icons.map(([icon, label]) => (
                    <Swatch
                      key={icon}
                      label={label}
                      selected={value.icon === icon}
                      className="flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                      onSelect={() => {
                        onChange({ ...value, icon });
                        close();
                      }}
                    >
                      <NodeTypeIcon icon={icon} aria-hidden="true" />
                    </Swatch>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      )}
    </PopoverSwatchPicker>
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
      contentClassName="w-72 p-3"
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
    >
      {(close) => (
        <div className="grid grid-cols-5 gap-2">
          {nodeTypeColorPalette.map(({ value: color, label }) => {
            const selected = value.color === color;
            return (
              <Swatch
                key={color}
                label={label}
                selected={selected}
                className="flex size-10 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2"
                style={{ backgroundColor: color }}
                onSelect={() => {
                  onChange({ ...value, color: color as NodeTypeColor });
                  close();
                }}
              >
                {selected ? <Check className="text-white" aria-hidden="true" /> : null}
              </Swatch>
            );
          })}
        </div>
      )}
    </PopoverSwatchPicker>
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
