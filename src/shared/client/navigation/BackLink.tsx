'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/shared/ui/button-variants';
import { usePreviousPath } from './navigation-history';

export function BackLink({ fallbackHref }: Readonly<{ fallbackHref: string }>) {
  const previous = usePreviousPath();
  return (
    <Link
      className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2 w-fit' })}
      href={previous ?? fallbackHref}
    >
      <ArrowLeft data-icon="inline-start" />
      Volver
    </Link>
  );
}
