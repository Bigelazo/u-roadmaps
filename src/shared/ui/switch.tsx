'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

import { cn } from 'cn';

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-steel/45 p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card dark:inset-ring-2 dark:inset-ring-input data-checked:bg-primary dark:data-checked:bg-input',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform duration-150 dark:bg-input data-checked:translate-x-5 dark:data-checked:bg-white"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
