import RoadmapCanvas from '@/components/RoadmapCanvas';
import { resolveSessionUser, getApplicationSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Props = { params: Promise<{ ramo: string; anio: string; semestre: string }> };

export default async function CoursePage({ params }: Props) {
  const resolvedParams = await params;
  const anio = Number(resolvedParams.anio);
  const semestre = Number(resolvedParams.semestre);
  return <CourseContent params={resolvedParams} anio={anio} semestre={semestre} />;
}

async function CourseContent({
  params,
  anio,
  semestre,
}: {
  params: { ramo: string; anio: string; semestre: string };
  anio: number;
  semestre: number;
}) {
  const user = await resolveSessionUser(await getApplicationSession());
  const course = user
    ? await prisma.curso.findUnique({
        where: { ramoCodigo_anio_semestre: { ramoCodigo: params.ramo, anio, semestre } },
        include: { usuarios: { where: { usuarioId: user.id, vigente: true, funcion: 'DOCENTE' } } },
      })
    : null;
  const canEdit = Boolean(user && course?.usuarios.length);
  return (
    <main className="min-h-screen bg-[#f7f7f7] px-4 py-8 text-[#1a1a1a] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1366px] space-y-6">
        <header className="rounded-2xl bg-[#1a1a1a] p-8 text-white">
          <p className="text-sm uppercase tracking-[0.16em] text-[#8ebdce]">Curso</p>
          <h1 className="mt-3 text-[24px] font-medium leading-[1.17]">{params.ramo}</h1>
          <p className="mt-2 text-[#c2c2c2]">
            {anio}, semestre {semestre}
          </p>
        </header>
        <RoadmapCanvas route={{ ramo: params.ramo, anio, semestre }} canEdit={canEdit} />
      </div>
    </main>
  );
}
