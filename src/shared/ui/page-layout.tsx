import type * as React from 'react';
import { cn } from 'cn';

/** A bordered card whose rows are separated by dividers. */
export const dividedListClassName =
  'divide-y divide-fog overflow-hidden rounded-xl border border-fog bg-card';

/** The full-height page canvas around a centered content column. */
export function PageShell({
  className,
  children,
}: Readonly<{ className: string; children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-cloud py-10 text-foreground md:py-16">
      <div className={className}>{children}</div>
    </main>
  );
}

export function PageEyebrow({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function PageTitle({ className, ...props }: React.ComponentProps<'h1'>) {
  return (
    <h1
      className={cn('font-heading text-4xl font-semibold tracking-[-0.04em]', className)}
      {...props}
    />
  );
}
