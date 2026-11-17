'use client';

import { useLinkStatus } from 'next/link';
import { Spinner } from './spinner';

export function PendingLinkContent({
  icon,
  children,
}: Readonly<{ icon: React.ReactNode; children: React.ReactNode }>) {
  const { pending } = useLinkStatus();
  if (!pending) {
    return (
      <>
        {icon}
        {children}
      </>
    );
  }
  return (
    <>
      <Spinner aria-hidden="true" data-icon="inline-start" data-link-pending="" />
      Cargando...
    </>
  );
}
