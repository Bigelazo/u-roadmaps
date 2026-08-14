import 'next-auth';
import 'next-auth/jwt';

type VtiClaimValue =
  | string
  | number
  | boolean
  | null
  | VtiClaimValue[]
  | { [key: string]: VtiClaimValue };

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
    vtiClaims?: Record<string, VtiClaimValue>;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string;
    preferred_username?: string;
    vtiClaims?: Record<string, VtiClaimValue>;
  }
}
