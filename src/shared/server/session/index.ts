import 'server-only';

import { getServerSession, type NextAuthOptions, type Session } from 'next-auth';
import { prisma } from '@/shared/server/db';
import { ApplicationError, applicationResult } from '@/shared/errors/server';

const sessionSecret = process.env.NEXTAUTH_SECRET;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const authOptions: NextAuthOptions = {
  secret: sessionSecret,
  session: { strategy: 'jwt' },
  providers: [],
  pages: { signIn: '/api/plogin/start' },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.useLocalFixtureData = token.useLocalFixtureData === true;
      }
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
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user && { ...user, useLocalFixtureData: session.user.useLocalFixtureData === true };
}

export function requireAuthenticatedUser() {
  return applicationResult(async () => {
    const user = await resolveSessionUser(await getApplicationSession());
    if (!user) {
      throw new ApplicationError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
    }
    return user;
  });
}
