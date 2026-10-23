import 'server-only';

import { getServerSession, type NextAuthOptions, type Session } from 'next-auth';

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
