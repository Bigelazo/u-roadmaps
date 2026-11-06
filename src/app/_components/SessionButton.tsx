'use client';

import { useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { InstitutionalLoginForm } from './InstitutionalLoginForm';
import { ConfirmationDialog, type ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

const LOGOUT_ACTION_ID = 'logout';

const logoutConfirmation = {
  title: '¿Cerrar sesión?',
  description: 'Tendrás que autenticarte nuevamente para ingresar.',
  intent: 'destructive',
  actions: [{ id: LOGOUT_ACTION_ID, label: 'Cerrar sesión' }],
} as const satisfies ConfirmationPresentation;

export default function SessionButton({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [confirmation, setConfirmation] = useState<ConfirmationPresentation | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string>();
  const logoutFormRef = useRef<HTMLFormElement>(null);

  if (!isAuthenticated) return <InstitutionalLoginForm tone="outline" size="default" compact />;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="max-sm:w-11 max-sm:px-0"
        onClick={() => {
          setPendingActionId(undefined);
          setConfirmation(logoutConfirmation);
        }}
      >
        <LogOut aria-hidden="true" className="sm:hidden" />
        <span className="max-sm:sr-only">Cerrar sesión</span>
      </Button>
      <form ref={logoutFormRef} action="/api/logout" method="post" className="hidden" />
      <ConfirmationDialog
        confirmation={confirmation}
        pendingActionId={pendingActionId}
        onCancel={() => {
          setPendingActionId(undefined);
          setConfirmation(null);
        }}
        onAction={(actionId) => {
          if (actionId !== LOGOUT_ACTION_ID) return;

          setPendingActionId(actionId);
          logoutFormRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
