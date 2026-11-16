'use client';

import { ServerErrorPage, type ErrorBoundaryProps } from '@/app/_components/ServerErrorPage';

export default function SiteError(props: ErrorBoundaryProps) {
  return <ServerErrorPage {...props} />;
}
