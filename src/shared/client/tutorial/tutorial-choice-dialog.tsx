'use client';

import { ClockCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

export function TutorialChoiceDialog({
  open,
  onOpenChange,
  origin,
  declinable = false,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: string;
  declinable?: boolean;
}>) {
  const router = useRouter();
  const start = (experience: 'teaching' | 'student') =>
    router.push(`/practice-roadmap/${experience}?${new URLSearchParams({ origin })}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Deseas realizar el tutorial?</DialogTitle>
          <DialogDescription>
            Aprende los conceptos básicos de la plataforma en un Roadmap de prueba. Disponible para
            ambos roles.
          </DialogDescription>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <ClockCheck aria-hidden="true" className="size-4 text-primary" />
            Tiempo estimado: 1-3 min.
          </p>
        </DialogHeader>
        <DialogFooter>
          {declinable ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Ahora no
            </Button>
          ) : null}
          <Button onClick={() => start('teaching')}>Docente</Button>
          <Button onClick={() => start('student')}>Estudiante</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
