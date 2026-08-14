'use client';

import { Button } from '@mui/material';
import { signOut } from 'next-auth/react';

export default function SessionButton({ isAuthenticated }: { isAuthenticated: boolean }) {
  if (!isAuthenticated)
    return (
      <Button href="/auth/signin" variant="outlined">
        Autenticarse
      </Button>
    );

  return (
    <Button variant="outlined" color="inherit" onClick={() => void signOut({ callbackUrl: '/' })}>
      Cerrar sesión
    </Button>
  );
}
