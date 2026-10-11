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
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

type Swatch<T> = { value: T; label: string; style?: CSSProperties; content?: ReactNode };

type Props<T> = {
  id: string;
  /** Accessible name of the trigger, which also announces the current selection. */
  ariaLabel: string;
  title: string;
  /** Visible trigger content: the current selection or a prompt to choose one. */
  selection: ReactNode;
  contentClassName: string;
  gridClassName: string;
  swatchClassName: string;
  /** Labelled sections render inside a scroll area; a single unlabelled one renders as a grid. */
  sections: { label?: string; swatches: Swatch<T>[] }[];
  value: T | undefined;
  onSelect: (value: T) => void;
};

/** Outline trigger that opens a titled popover of toggle swatches and closes on selection. */
export function PopoverSwatchPicker<T extends string>({
  id,
  ariaLabel,
  title,
  selection,
  contentClassName,
  gridClassName,
  swatchClassName,
  sections,
  value,
  onSelect,
}: Props<T>) {
  const [open, setOpen] = useState(false);

  const grid = (swatches: Swatch<T>[]) => (
    <div className={gridClassName}>
      {swatches.map((swatch) => (
        <Tooltip key={swatch.value}>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={swatch.label}
                aria-pressed={value === swatch.value}
                className={swatchClassName}
                style={swatch.style}
                onClick={() => {
                  onSelect(swatch.value);
                  setOpen(false);
                }}
              />
            }
          >
            {swatch.content}
          </TooltipTrigger>
          <TooltipContent>{swatch.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );

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
        {sections.some((section) => section.label) ? (
          <ScrollArea className="h-80">
            <div className="flex flex-col gap-4 pr-2">
              {sections.map((section) => (
                <section key={section.label} aria-label={section.label}>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                    {section.label}
                  </h3>
                  {grid(section.swatches)}
                </section>
              ))}
            </div>
          </ScrollArea>
        ) : (
          grid(sections.flatMap((section) => section.swatches))
        )}
      </PopoverContent>
    </Popover>
  );
}
