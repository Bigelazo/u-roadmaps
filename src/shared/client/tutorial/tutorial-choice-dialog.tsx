'use client';

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

/**
 * Asks which Roadmap tutorial to run and opens the Practice roadmap in that experience,
 * with `origin` as the page "Salir" returns to. Controlled, so any page can open it.
 */
export function TutorialChoiceDialog({
  open,
  onOpenChange,
  origin,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void; origin: string }>) {
  const router = useRouter();
  const start = (experience: 'teaching' | 'student') =>
    router.push(`/practice-roadmap/${experience}?${new URLSearchParams({ origin })}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Cómo deseas realizar el tutorial?</DialogTitle>
          <DialogDescription>
            Practica en un Roadmap de prueba. Nada de lo que hagas se guarda.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => start('teaching')}>
            Docente
          </Button>
          <Button onClick={() => start('student')}>Estudiante</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
