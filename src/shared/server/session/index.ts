import 'server-only';

import { cache } from 'react';
import { getServerSession, type NextAuthOptions, type Session } from 'next-auth';

const sessionSecret = process.env.NEXTAUTH_SECRET;

export const authOptions: NextAuthOptions = {
  secret: sessionSecret,
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.useLocalFixtureData = token.useLocalFixtureData === true;
        session.user.issuedAt = typeof token.iat === 'number' ? token.iat : 0;
      }
      return session;
    },
  },
};

export const getApplicationSession = cache(async (): Promise<Session | null> => {
  if (!sessionSecret) return null;
  return getServerSession(authOptions);
});
