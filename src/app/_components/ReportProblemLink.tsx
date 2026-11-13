'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const maintainerEmail = 'danielramirez@ug.uchile.cl';
const subject = 'Problema en U-Roadmaps';

export function reportProblemHref(pageUrl: string | null, version: string) {
  const body = [
    '¿Qué ocurrió?',
    '',
    '',
    '¿Qué esperabas que ocurriera?',
    '',
    '',
    '---',
    ...(pageUrl ? [`Página: ${pageUrl}`] : []),
    `Versión: ${version}`,
  ].join('\n');
  return `mailto:${maintainerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ReportProblemLink({ version }: { version: string }) {
  const pathname = usePathname();
  const [pageUrl, setPageUrl] = useState<string | null>(null);

  useEffect(() => {
    setPageUrl(`${window.location.origin}${pathname}`);
  }, [pathname]);

  return (
    <a
      href={reportProblemHref(pageUrl, version)}
      className="inline-flex min-h-11 items-center underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Reportar un problema
    </a>
  );
}
