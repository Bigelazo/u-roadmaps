import type * as React from 'react';
import { cn } from 'cn';
import { PageEyebrow, PageTitle } from '@/shared/ui/page-layout';

export function StatusPage({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}>) {
  return (
    <main data-status-page className="flex-1 bg-cloud py-16 text-foreground md:py-24">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        {eyebrow ? <PageEyebrow>{eyebrow}</PageEyebrow> : null}
        <PageTitle className={cn('text-balance', eyebrow && 'mt-3')}>{title}</PageTitle>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-pretty text-graphite">
          {description}
        </p>
        {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
      </div>
    </main>
  );
}
