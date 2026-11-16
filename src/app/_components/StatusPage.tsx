import type * as React from 'react';
import { PageEyebrow, PageTitle } from '@/shared/ui/page-layout';

export function StatusPage({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}>) {
  return (
    <main className="flex flex-1 flex-col bg-cloud py-16 text-foreground md:py-24">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <PageEyebrow>{eyebrow}</PageEyebrow>
        <PageTitle className="mt-3 text-balance">{title}</PageTitle>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-pretty text-graphite">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">{children}</div>
      </div>
    </main>
  );
}
