'use client';

import { ServerErrorPage, type ErrorBoundaryProps } from '@/app/_components/ServerErrorPage';

export default function RouteError(props: ErrorBoundaryProps) {
  return <ServerErrorPage {...props} />;
}
