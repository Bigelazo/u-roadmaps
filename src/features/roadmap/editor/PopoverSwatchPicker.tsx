import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/shared/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

type Props = {
  id: string;
  /** Accessible name of the trigger, which also announces the current selection. */
  ariaLabel: string;
  title: string;
  /** Visible trigger content: the current selection or a prompt to choose one. */
  selection: ReactNode;
  contentClassName: string;
  /** Renders the swatches; `close` dismisses the popover after a selection. */
  children: (close: () => void) => ReactNode;
};

/** Outline trigger that opens a titled popover of swatch buttons and closes on selection. */
export function PopoverSwatchPicker({
  id,
  ariaLabel,
  title,
  selection,
  contentClassName,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-label={ariaLabel}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2 truncate">{selection}</span>
        <ChevronDown data-icon="inline-end" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className={contentClassName}>
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** Toggle-style swatch with a tooltip; `aria-pressed` marks the current selection. */
export function Swatch({
  label,
  selected,
  className,
  style,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  className: string;
  style?: CSSProperties;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={selected}
            className={className}
            style={style}
            onClick={onSelect}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
