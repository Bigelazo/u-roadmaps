'use client';

import { Button } from '@/shared/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';

export default function SessionButton({ isAuthenticated }: { isAuthenticated: boolean }) {
  if (!isAuthenticated)
    return (
      <form action="/api/plogin/start" method="post">
        <Button type="submit" variant="outline">
          Autenticarse
        </Button>
      </form>
    );

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" />}>Cerrar sesión</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
          <AlertDialogDescription>
            Tendrás que autenticarte nuevamente para ingresar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action="/api/logout" method="post">
            <AlertDialogAction type="submit" variant="destructive">
              Cerrar sesión
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
