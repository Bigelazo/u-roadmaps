import 'server-only';

import { getServerSession, type NextAuthOptions, type Session } from 'next-auth';
import { prisma } from '@/shared/server/db';
import { ApplicationError, applicationResult } from '@/shared/errors/server';
import { isUuid } from '@/shared/validation';

const sessionSecret = process.env.NEXTAUTH_SECRET;

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
  if (!isUuid(userId)) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user && { ...user, useLocalFixtureData: session?.user?.useLocalFixtureData === true };
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
