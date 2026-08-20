import { getServerSession, type NextAuthOptions, type Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { ApiError, apiResult, type CourseOfferingIdentifier } from '@/lib/roadmap-api';

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
};

export async function getApplicationSession(): Promise<Session | null> {
  if (!sessionSecret) return null;
  return getServerSession(authOptions);
}

export async function resolveSessionUser(session: Session | null) {
  const userId = session?.user?.id;
  if (!userId || !uuidPattern.test(userId)) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

async function requireAuthenticatedUserUnsafe() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
  return user;
}

async function requireCourseOfferingParticipationUnsafe(
  identifier: CourseOfferingIdentifier,
  allowedRoles: Array<'STUDENT' | 'TEACHER'>,
) {
  const user = await requireAuthenticatedUserUnsafe();
  const courseOffering = await prisma.courseOffering.findUnique({
    where: {
      courseCode_year_semester: identifier,
    },
    include: { roadmap: true },
  });
  if (!courseOffering)
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  const participation = await prisma.participation.findFirst({
    where: {
      userId: user.id,
      courseOfferingId: courseOffering.id,
      isActive: true,
      role: { in: allowedRoles },
    },
  });
  if (!participation)
    throw new ApiError(403, 'FORBIDDEN', 'No tienes participación vigente para esta operación.');
  return { user, courseOffering, participation };
}

async function requireCourseOfferingTeacherUnsafe(identifier: CourseOfferingIdentifier) {
  return requireCourseOfferingParticipationUnsafe(identifier, ['TEACHER']);
}

async function requireRoadmapCreationAccessUnsafe(identifier: CourseOfferingIdentifier) {
  const user = await requireAuthenticatedUserUnsafe();
  const courseOffering = await prisma.courseOffering.findUnique({
    where: {
      courseCode_year_semester: identifier,
    },
  });
  if (!courseOffering) return { user, courseOffering: null };
  const participation = await prisma.participation.findFirst({
    where: {
      userId: user.id,
      courseOfferingId: courseOffering.id,
      isActive: true,
      role: 'TEACHER',
    },
  });
  if (!participation)
    throw new ApiError(
      403,
      'FORBIDDEN',
      'No tienes participación docente vigente para esta operación.',
    );
  return { user, courseOffering };
}

export function requireAuthenticatedUser() {
  return apiResult(requireAuthenticatedUserUnsafe);
}

export function requireCourseOfferingParticipation(
  identifier: CourseOfferingIdentifier,
  allowedRoles: Array<'STUDENT' | 'TEACHER'>,
) {
  return apiResult(() => requireCourseOfferingParticipationUnsafe(identifier, allowedRoles));
}

export function requireCourseOfferingTeacher(identifier: CourseOfferingIdentifier) {
  return apiResult(() => requireCourseOfferingTeacherUnsafe(identifier));
}

export function requireRoadmapCreationAccess(identifier: CourseOfferingIdentifier) {
  return apiResult(() => requireRoadmapCreationAccessUnsafe(identifier));
}
