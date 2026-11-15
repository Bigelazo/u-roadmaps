import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';

export function RoadmapCanvasLoading({ isCanvasPreview = false }: { isCanvasPreview?: boolean }) {
  const title = isCanvasPreview ? 'Cargando simulación...' : 'Cargando roadmap...';

  return (
    <section
      data-page-width="full"
      aria-busy="true"
      className="roadmap-canvas-loading flex min-h-0 w-full flex-1 bg-background"
    >
      <Empty role="status" aria-label={title} className="rounded-none">
        <EmptyHeader>
          <EmptyMedia>
            <Spinner role="img" aria-hidden="true" className="size-8 motion-reduce:animate-none" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>
            {isCanvasPreview
              ? 'Preparando la vista de estudiante.'
              : 'Preparando los nodos y sus conexiones.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

export function RoadmapPageLoading() {
  return (
    <main
      data-viewport-page
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-cloud"
    >
      <RoadmapCanvasLoading />
    </main>
  );
}
