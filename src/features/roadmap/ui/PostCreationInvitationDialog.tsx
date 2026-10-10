'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { useClaimTutorialInvitation } from '@/shared/client/tutorial/tutorial-records';
import type { PostCreationInvitationWording } from '../types';

/**
 * Invites a course professor, on the Roadmap canvas they just created, to the teaching
 * tutorial. "Salir" from the tutorial returns to `origin`, this new Roadmap.
 */
export function PostCreationInvitationDialog({
  wording,
  origin,
}: {
  wording: PostCreationInvitationWording;
  origin: string;
}) {
  const [open, setOpen] = useState(true);
  useClaimTutorialInvitation('post-creation', true);
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¡Roadmap creado!</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Quieres {wording} el tutorial de edición? Te muestra cómo construir el roadmap en un
            mapa de práctica, sin cambiar este.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="outline">Ahora no</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              router.push(`/practice-roadmap/teaching?${new URLSearchParams({ origin })}`);
            }}
          >
            Hacer tutorial
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
