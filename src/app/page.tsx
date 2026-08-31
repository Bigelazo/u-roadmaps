import { ArrowRight, BookOpen, ListChecks, Map as MapIcon } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getApplicationSession, resolveSessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const courseBenefits = [
  {
    icon: MapIcon,
    title: 'Explora el mapa del curso',
    description: 'Visualiza unidades, evaluaciones y materiales complementarios en una sola ruta.',
  },
  {
    icon: ListChecks,
    title: 'Sigue tu avance',
    description:
      'Identifica qué contenidos ya completaste y cuáles debes preparar antes de continuar.',
  },
  {
    icon: BookOpen,
    title: 'Encuentra recursos a tiempo',
    description: 'Accede a lecturas, archivos y enlaces asociados directamente a cada tema.',
  },
];

const sampleRoute = [
  {
    label: 'Completado',
    title: 'Variables',
    variant: 'progress' as const,
    markerClassName: 'bg-progress',
  },
  {
    label: 'Estás aquí',
    title: 'Funciones',
    variant: 'progress' as const,
    cardClassName: 'bg-progress-soft ring-progress',
  },
  { label: 'Siguiente', title: 'Estructuras', variant: 'outline' as const },
];

export default async function Home() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (user) redirect('/academic-overview');

  return (
    <main className="min-h-screen bg-cloud text-foreground">
      <div className="mx-auto max-w-[1440px] px-6 py-10 md:py-20">
        <section className="overflow-hidden rounded-xl bg-ink p-6 text-primary-foreground sm:p-8 md:grid md:grid-cols-[minmax(0,1fr)_420px] md:gap-12 md:p-14">
          <div className="max-w-2xl">
            <p className="mb-5 text-xs font-bold tracking-[0.1em] text-primary-soft uppercase">
              U-Roadmaps
            </p>
            <h1 className="font-heading text-5xl leading-[0.98] font-semibold tracking-[-0.05em] md:text-7xl">
              Cada curso, una ruta clara.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/85">
              U-Roadmaps muestra cómo se conectan los contenidos de tus cursos para que puedas
              preparar cada unidad con una visión clara de sus requisitos y recursos.
            </p>
            <form action="/api/plogin/start" method="post" className="mt-8">
              <Button size="lg" type="submit">
                Ingresar con U-Pasaporte <ArrowRight aria-hidden="true" data-icon="inline-end" />
              </Button>
            </form>
          </div>
          <ol
            aria-label="Ruta de aprendizaje de ejemplo"
            className="relative mt-10 flex flex-col gap-4 pl-8 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-px before:bg-primary-bright md:mt-0 md:grid md:grid-cols-3 md:items-start md:gap-4 md:pt-8 md:pl-0 md:before:top-2 md:before:right-4 md:before:bottom-auto md:before:left-4 md:before:h-px md:before:w-auto"
          >
            {sampleRoute.map(({ label, title, variant, cardClassName, markerClassName }) => (
              <li className="relative md:last:mt-24 md:even:mt-12" key={title}>
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-4 -left-8 size-4 rounded-full border-4 border-ink bg-primary-soft md:-top-6 md:left-1/2 md:-translate-x-1/2',
                    markerClassName,
                  )}
                />
                <Card
                  className={cn(
                    '[--card-spacing:--spacing(4)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
                    cardClassName,
                  )}
                  size="sm"
                >
                  <CardHeader className="gap-2">
                    <Badge variant={variant}>{label}</Badge>
                    <h2 className="font-heading text-lg font-semibold tracking-[-0.02em]">
                      {title}
                    </h2>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
            Una ruta para cada curso
          </p>
          <h2 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.04em]">
            Lo importante, en el orden que importa.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {courseBenefits.map(({ icon: Icon, title, description }) => (
              <article key={title}>
                <Card className="h-full min-h-52 [--card-spacing:--spacing(6)]">
                  <CardHeader className="gap-6">
                    <div className="grid size-11 place-items-center rounded-md bg-primary-soft text-primary">
                      <Icon aria-hidden="true" />
                    </div>
                    <h3 className="font-heading text-2xl font-semibold tracking-[-0.02em]">
                      {title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="leading-relaxed text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              </article>
            ))}
          </div>
        </section>
      </div>
      <footer className="border-t bg-card">
        <div className="mx-auto max-w-[1440px] px-6 py-5 text-sm text-muted-foreground">
          Universidad de Chile
        </div>
      </footer>
    </main>
  );
}
