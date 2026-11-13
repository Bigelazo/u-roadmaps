import { Suspense } from 'react';
import { readRepositoryStars, repositoryUrl } from '@/app/_adapters/github';
import { RepositoryLink } from '@/app/_components/RepositoryLink';
import { ReportProblemDialog } from '@/app/_components/ReportProblemDialog';
import { ThirdPartyLicensesLink } from '@/app/_components/ThirdPartyLicensesLink';
import packageJson from '../../../package.json';

async function StarredRepositoryLink() {
  return <RepositoryLink href={repositoryUrl} stars={await readRepositoryStars()} />;
}

export function SiteFooter() {
  return (
    <footer className="shrink-0 border-t bg-background text-sm text-graphite">
      <div className="mx-auto flex max-w-360 flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-8 [body:has([data-page-width=full])_&]:max-w-none">
        <div className="flex flex-col gap-1">
          <p>
            <span className="font-semibold text-ink">U-Roadmaps</span> · Cada curso, una ruta clara.
          </p>
          <p>
            <span className="inline-block">Creado por Daniel Ramírez López ·</span>{' '}
            <span className="inline-block">Universidad de Chile</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6">
          <ThirdPartyLicensesLink />
          <ReportProblemDialog version={packageJson.version} />
          <span className="tabular-nums">v{packageJson.version}</span>
          <Suspense fallback={<RepositoryLink href={repositoryUrl} stars={null} />}>
            <StarredRepositoryLink />
          </Suspense>
        </div>
      </div>
    </footer>
  );
}
