'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

export default function SessionButton({ isAuthenticated }: { isAuthenticated: boolean }) {
  if (!isAuthenticated)
    return (
      <Link className={buttonVariants({ variant: 'outline' })} href="/api/plogin/start">
        Autenticarse
      </Link>
    );

  return (
    <Button variant="outline" onClick={() => void signOut({ callbackUrl: '/' })}>
      Cerrar sesión
    </Button>
  );
}
