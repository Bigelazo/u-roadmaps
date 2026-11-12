import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';

export function AcademicOverviewLoading() {
  const title = 'Cargando resumen académico...';

  return (
    <main
      data-viewport-page
      aria-busy="true"
      className="flex min-h-0 flex-1 bg-cloud text-foreground"
    >
      <Empty role="status" aria-label={title} className="rounded-none">
        <EmptyHeader>
          <EmptyMedia>
            <Spinner role="img" aria-hidden="true" className="size-8" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>Preparando tus cursos y semestres.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
