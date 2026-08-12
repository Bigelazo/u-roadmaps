import RoadmapCanvas from '@/components/RoadmapCanvas';

type Props = { params: { ramo: string; anio: string; semestre: string } };

export default function CoursePage({ params }: Props) {
  const anio = Number(params.anio);
  const semestre = Number(params.semestre);
  return <main className="min-h-screen bg-[#f7f7f7] px-4 py-8 text-[#1a1a1a] sm:px-8 lg:px-12"><div className="mx-auto max-w-[1366px] space-y-6"><header className="rounded-2xl bg-[#1a1a1a] p-8 text-white"><p className="text-sm uppercase tracking-[0.16em] text-[#8ebdce]">Curso</p><h1 className="mt-3 text-[24px] font-medium leading-[1.17]">{params.ramo}</h1><p className="mt-2 text-[#c2c2c2]">{anio}, semestre {semestre}</p></header><RoadmapCanvas route={{ ramo: params.ramo, anio, semestre }} /></div></main>;
}
