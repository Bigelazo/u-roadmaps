'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { useClaimTutorialInvitation } from '@/shared/client/tutorial/tutorial-records';
import type { PostCreationInvitationWording } from '../types';

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
    <ConfirmationDialog
      confirmation={
        open
          ? {
              title: '¡Roadmap creado!',
              description: `¿Quieres ${wording} el tutorial de edición? Te muestra cómo construir el roadmap en un mapa de práctica, sin cambiar este.`,
              intent: 'default',
              cancelLabel: 'Ahora no',
              actions: [{ id: 'tutorial', label: 'Hacer tutorial' }],
            }
          : null
      }
      onCancel={() => setOpen(false)}
      onAction={() => {
        setOpen(false);
        router.push(`/practice-roadmap/teaching?${new URLSearchParams({ origin })}`);
      }}
    />
  );
}
