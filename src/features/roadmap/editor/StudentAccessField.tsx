import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from 'cn';

const options = [
  {
    value: 'visible',
    label: 'Visible',
    Icon: Eye,
    consequence: 'Aparecerá en la ruta de los estudiantes.',
  },
  {
    value: 'hidden',
    label: 'Oculto',
    Icon: EyeOff,
    consequence: 'Solo el equipo docente lo verá hasta que lo muestres.',
  },
] as const;

export function StudentAccessField({
  idPrefix,
  isVisible,
  disabled,
  onVisibleChange,
}: {
  idPrefix: string;
  isVisible: boolean;
  disabled?: boolean;
  onVisibleChange: (isVisible: boolean) => void;
}) {
  const labelId = `${idPrefix}-access-label`;
  const consequenceId = `${idPrefix}-access-consequence`;
  const selected = options[isVisible ? 0 : 1];

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium">
        Acceso de estudiantes
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        aria-describedby={consequenceId}
        value={selected.value}
        disabled={disabled}
        onValueChange={(value) => onVisibleChange(value === 'visible')}
        className="grid grid-cols-2 rounded-lg bg-muted p-[3px]"
      >
        {options.map(({ value, label, Icon }) => (
          <Radio.Root
            key={value}
            value={value}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors outline-none',
              'hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              'data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm',
              'data-disabled:pointer-events-none data-disabled:opacity-50',
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {label}
          </Radio.Root>
        ))}
      </RadioGroup>
      <p id={consequenceId} aria-live="polite" className="text-sm text-muted-foreground">
        {selected.consequence}
      </p>
    </div>
  );
}
