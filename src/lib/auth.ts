import { getServerSession, type NextAuthOptions, type Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/roadmap-api';

const sessionSecret = process.env.NEXTAUTH_SECRET;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const authOptions: NextAuthOptions = {
  secret: sessionSecret,
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: { signIn: '/auth/signin' },
};

export async function getApplicationSession(): Promise<Session | null> {
  if (!sessionSecret) return null;
  return getServerSession(authOptions);
}

export async function resolveSessionUser(session: Session | null) {
  const userId = session?.user?.id;
  if (!userId || !uuidPattern.test(userId)) return null;
  return prisma.usuario.findUnique({ where: { id: userId } });
}

export async function requireAuthenticatedUser() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
  return user;
}

export async function requireCourseParticipation(
  path: { ramo: string; anio: number; semestre: number },
  allowedFunctions: Array<'ESTUDIANTE' | 'DOCENTE'>,
) {
  const user = await requireAuthenticatedUser();
  const course = await prisma.curso.findUnique({
    where: {
      ramoCodigo_anio_semestre: { ramoCodigo: path.ramo, anio: path.anio, semestre: path.semestre },
    },
    include: { roadmap: true },
  });
  if (!course)
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  const participation = await prisma.participacion.findFirst({
    where: {
      usuarioId: user.id,
      cursoId: course.id,
      vigente: true,
      funcion: { in: allowedFunctions },
    },
  });
  if (!participation)
    throw new ApiError(403, 'FORBIDDEN', 'No tienes participación vigente para esta operación.');
  return { user, course, participation };
}

export async function requireCourseTeacher(path: { ramo: string; anio: number; semestre: number }) {
  return requireCourseParticipation(path, ['DOCENTE']);
}

export async function requireRoadmapCreationAccess(path: {
  ramo: string;
  anio: number;
  semestre: number;
}) {
  const user = await requireAuthenticatedUser();
  const course = await prisma.curso.findUnique({
    where: {
      ramoCodigo_anio_semestre: { ramoCodigo: path.ramo, anio: path.anio, semestre: path.semestre },
    },
  });
  if (!course) return { user, course: null };
  const participation = await prisma.participacion.findFirst({
    where: { usuarioId: user.id, cursoId: course.id, vigente: true, funcion: 'DOCENTE' },
  });
  if (!participation)
    throw new ApiError(
      403,
      'FORBIDDEN',
      'No tienes participación docente vigente para esta operación.',
    );
  return { user, course };
}
