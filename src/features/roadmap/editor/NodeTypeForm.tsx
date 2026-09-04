import { Check, ChevronDown, Plus, Save } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/shared/ui/popover';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
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
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id="node-type-icon"
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-label={`Ícono: ${selectedIcon?.label ?? 'sin selección'}`}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {value.icon ? (
            <NodeTypeIcon icon={value.icon} data-icon="inline-start" aria-hidden="true" />
          ) : null}
          {selectedIcon?.label ?? 'Elegir ícono'}
        </span>
        <ChevronDown data-icon="inline-end" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <PopoverHeader>
          <PopoverTitle>Elegir ícono</PopoverTitle>
        </PopoverHeader>
        <ScrollArea className="h-80">
          <div className="flex flex-col gap-4 pr-2">
            {teachingIconCatalog.map((category) => (
              <section key={category.label} aria-label={category.label}>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                  {category.label}
                </h3>
                <div className="grid grid-cols-8 gap-1">
                  {category.icons.map(([icon, label]) => {
                    const selected = value.icon === icon;
                    return (
                      <Tooltip key={icon}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label={label}
                              aria-pressed={selected}
                              className="flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                              onClick={() => onChange({ ...value, icon })}
                            />
                          }
                        >
                          <NodeTypeIcon icon={icon} aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function ColorPicker({ value, onChange }: Pick<Props, 'value' | 'onChange'>) {
  const selectedColor = value.color
    ? nodeTypeColorPalette.find(({ value: color }) => color === value.color)
    : undefined;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id="node-type-color"
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-label={`Color: ${selectedColor?.label ?? 'sin selección'}`}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedColor ? (
            <span
              className="size-4 shrink-0 rounded-full ring-1 ring-foreground/20"
              style={{ backgroundColor: selectedColor.value }}
              aria-hidden="true"
            />
          ) : null}
          {selectedColor?.label ?? 'Elegir color'}
        </span>
        <ChevronDown data-icon="inline-end" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <PopoverHeader>
          <PopoverTitle>Elegir color</PopoverTitle>
        </PopoverHeader>
        <div className="grid grid-cols-5 gap-2">
          {nodeTypeColorPalette.map(({ value: color, label }) => {
            const selected = value.color === color;
            return (
              <Tooltip key={color}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={selected}
                      className="flex size-10 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2"
                      style={{ backgroundColor: color }}
                      onClick={() => onChange({ ...value, color: color as NodeTypeColor })}
                    />
                  }
                >
                  {selected ? <Check className="text-white" aria-hidden="true" /> : null}
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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
              <FieldLabel htmlFor="node-type-icon">Ícono</FieldLabel>
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
